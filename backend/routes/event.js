const express = require('express');
const axios = require('axios');
const { S3Client, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const multer = require('multer');
const Event = require('../models/Event');
const EventHistory = require('../models/EventHistory');
const Vote = require('../models/Vote');
const User = require('../models/User');
const SubUser = require('../models/SubUser');
const { authenticateToken } = require('../middleware/auth');
const {
  getActiveRemainingCredits,
  normalizeSubscriptionForExpiry,
} = require('../utils/subscription');
const { getIpRestrictionSettings } = require('../utils/ipRestrictionStore');
const {
  canAddBufferTime,
  formatTimeInTimeZone,
  getEffectiveEndDateTime,
  getOriginalEndDateTime,
  getStartDateTime,
  getVotingWindow,
  isSameCalendarDay,
} = require('../utils/votingWindow');
const router = express.Router();
const upload = multer();

router.use(express.json());

const normalizeIp = (value) =>
  String(value || '')
    .trim()
    .replace(/^::ffff:/, '')
    .replace(/^\[|\]$/g, '')
    .replace(/^::1$/, '127.0.0.1')
    .replace(/^0:0:0:0:0:0:0:1$/, '127.0.0.1');

const parseForwardedHeaderIp = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return '';

  const firstSegment = raw.split(',')[0].trim();
  const match = firstSegment.match(/for=(?:"?\[?([^;\]\"]+)\]?"?)/i);
  if (match && match[1]) {
    return normalizeIp(match[1].split(':')[0]);
  }

  return normalizeIp(firstSegment);
};

const isMongoObjectId = (value) => /^[a-f\d]{24}$/i.test(String(value || ''));

const getRequestIp = (req) => {
  // Check a list of common headers that may contain the client's IP when
  // the app is behind proxies, load balancers, or CDNs.
  const headerCandidates = [
    'x-forwarded-for',
    'x-real-ip',
    'cf-connecting-ip',
    'true-client-ip',
    'x-client-ip',
    'forwarded-for',
    'forwarded',
  ];

  for (const h of headerCandidates) {
    const value = req.headers[h];
    if (!value) continue;
    if (Array.isArray(value) && value.length > 0) {
      const v = String(value[0] || '').trim();
      if (v) {
        return h === 'forwarded'
          ? parseForwardedHeaderIp(v)
          : normalizeIp(v.split(',')[0]);
      }
    }

    if (typeof value === 'string' && value.trim()) {
      return h === 'forwarded'
        ? parseForwardedHeaderIp(value)
        : normalizeIp(value.split(',')[0]);
    }
  }

  const clientPublicIp = req.headers['x-client-public-ip'];
  if (clientPublicIp && req.ip) {
    const fallbackIp = normalizeIp(req.ip);
    if (fallbackIp === '127.0.0.1') {
      return normalizeIp(clientPublicIp);
    }
  }

  // Express exposes `req.ip` which respects `trust proxy` when configured.
  // Fall back to connection/socket addresses if needed.
  return normalizeIp(
    req.ip ||
      req.connection?.remoteAddress ||
      req.socket?.remoteAddress ||
      req.connection?.socket?.remoteAddress ||
      '',
  );
};

const formatIpRestrictionMessage = (user, requestIp) => {
  const rawAllowed = String(user?.allowedIp || '').trim();
  const enabled = !!user?.ipRestrictionEnabled;

  if (!enabled) {
    return {
      enabled: false,
      allowedIp: rawAllowed,
      requestIp,
      allowed: true,
      message: 'IP restriction is disabled for this voting link.',
    };
  }

  if (!rawAllowed) {
    return {
      enabled: true,
      allowedIp: '',
      requestIp,
      allowed: false,
      message:
        'IP restriction is enabled, but no allowed IP address has been configured yet.',
    };
  }

  // Support comma-separated allowed IP list. Normalize each entry and match.
  const allowedList = rawAllowed
    .split(',')
    .map((v) => normalizeIp(v))
    .filter(Boolean);

  const allowed = allowedList.includes(requestIp);
  const displayAllowed = allowedList.join(',');

  return {
    enabled: true,
    allowedIp: displayAllowed,
    requestIp,
    allowed,
    message: allowed
      ? `IP restriction is enabled. Only ${displayAllowed} can open this voting link.`
      : `Access denied from ${requestIp || 'unknown IP'}. Only ${displayAllowed} can open this voting link.`,
  };
};

const getVotingTimeAccess = (event, now = new Date()) => {
  const votingWindow = getVotingWindow(event, now);

  return {
    phase: votingWindow.phase,
    isOpen: votingWindow.isOpen,
    message: votingWindow.message,
    startDateTime: votingWindow.startDateTime,
    originalEndDateTime: votingWindow.originalEndDateTime,
    effectiveEndDateTime: votingWindow.effectiveEndDateTime,
    bufferMinutes: votingWindow.bufferMinutes,
  };
};

const getVotingAccess = async (event, req, now = new Date()) => {
  const timeAccess = getVotingTimeAccess(event, now);
  if (timeAccess.phase === 'closed') {
    return {
      ...timeAccess,
      enabled: false,
      allowedIp: '',
      requestIp: getRequestIp(req),
      allowed: false,
      message: 'Voting time is over.',
    };
  }

  if (timeAccess.phase === 'before-start') {
    return {
      ...timeAccess,
      enabled: false,
      allowedIp: '',
      requestIp: getRequestIp(req),
      allowed: false,
      message: 'Voting has not started yet.',
    };
  }

  const requestIp = getRequestIp(req);
  if (!event?.userId) {
    return {
      ...timeAccess,
      enabled: false,
      allowedIp: '',
      requestIp,
      allowed: true,
      message: 'IP restriction is disabled for this voting link.',
    };
  }

  let owner = null;
  if (isMongoObjectId(event.userId)) {
    try {
      owner = await User.findById(event.userId)
        .select('ipRestrictionEnabled allowedIp')
        .lean();
    } catch (error) {
      console.warn('Failed to resolve event owner for IP restriction:', {
        eventId: event.id,
        userId: event.userId,
        error: error.message,
      });
    }
  }

  const persistedIpSettings = await getIpRestrictionSettings(event.userId);
  const resolvedOwner = persistedIpSettings
    ? {
        ...owner,
        ipRestrictionEnabled:
          persistedIpSettings.ipRestrictionEnabled ??
          owner?.ipRestrictionEnabled,
        allowedIp:
          persistedIpSettings.allowedIp !== undefined
            ? persistedIpSettings.allowedIp
            : owner?.allowedIp,
      }
    : owner;

  const ipAccess = formatIpRestrictionMessage(resolvedOwner, requestIp);
  return {
    ...timeAccess,
    ...ipAccess,
  };
};

const getVotingOwnerAccess = async (event, req) => {
  return getVotingAccess(event, req);
};

const canManageEvents = (user = {}) => {
  if (user.role === 'admin') return true;
  if (user.role !== 'subuser') return false;

  const permissions = Array.isArray(user.permissions) ? user.permissions : [];
  return user.subUserRole === 'admin' || permissions.includes('/manage');
};

const requireManageAccess = (req, res, next) => {
  if (canManageEvents(req.user)) {
    return next();
  }

  return res.status(403).json({
    message: 'Access denied: manage permission required',
  });
};

const canAddBuffer = (user = {}) => user.role === 'admin' && !user.subUserId;

const requireSuperAdmin = (req, res, next) => {
  if (canAddBuffer(req.user)) {
    return next();
  }

  return res.status(403).json({
    message: 'Access denied: super admin permission required',
  });
};

const rowsMatch = (left, right) => {
  if (!left || !right) return false;
  const isMetaKey = (key) =>
    ['candidateImage', 'candidateRowIndex', 'candidateSelectionIndex'].includes(
      key,
    ) || key.startsWith('__');
  const leftKeys = Object.keys(left).filter((key) => !isMetaKey(key));
  const rightKeys = Object.keys(right).filter((key) => !isMetaKey(key));
  if (leftKeys.length !== rightKeys.length) return false;
  return leftKeys.every((key) => String(left[key]) === String(right[key]));
};

const normalizeCandidateImages = (event) => {
  if (!event || !Array.isArray(event.candidateImages)) return event;

  const fileData = Array.isArray(event.fileData) ? event.fileData : [];
  const selectedData = Array.isArray(event.selectedData)
    ? event.selectedData
    : [];

  const candidateImages = event.candidateImages.map((image) => {
    if (image?.selectedIndex !== undefined && image?.selectedIndex !== null) {
      return image;
    }

    const fileRowIndex =
      image?.fileRowIndex ?? image?.candidateIndex ?? image?.selectedIndex;
    let selectedIndex = null;

    if (fileRowIndex !== undefined && fileRowIndex !== null) {
      const fileRow = fileData[fileRowIndex];
      selectedIndex = selectedData.findIndex((selectedRow) =>
        rowsMatch(selectedRow, fileRow),
      );
    }

    return {
      ...image,
      fileRowIndex,
      selectedIndex: selectedIndex >= 0 ? selectedIndex : null,
    };
  });

  if (typeof event.toObject === 'function') {
    return {
      ...event.toObject(),
      candidateImages,
    };
  }

  return {
    ...event,
    candidateImages,
  };
};

const getEventStatus = (event) => {
  const window = getVotingWindow(event);
  if (window.phase === 'closed' || window.phase === 'invalid') return 'done';
  return 'active';
};

const getResultDate = (event) => {
  const endTime = getEffectiveEndDateTime(event);
  return endTime || null;
};

const getVoteSummary = (votes = []) => {
  const flattenedVotes = votes.flatMap((vote) => {
    if (Array.isArray(vote?.ballots) && vote.ballots.length > 0) {
      return vote.ballots.filter((entry) => entry && entry.candidate);
    }
    if (vote?.candidate) {
      return [
        {
          ballotId: 'main',
          candidate: vote.candidate,
          timestamp: vote.timestamp || null,
        },
      ];
    }
    return [];
  });

  const counts = flattenedVotes.reduce((acc, vote) => {
    acc[vote.candidate] = (acc[vote.candidate] || 0) + 1;
    return acc;
  }, {});

  const winnerEntry = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];

  return {
    totalVotes: flattenedVotes.length,
    winner: winnerEntry ? winnerEntry[0] : 'No votes yet',
    winnerVotes: winnerEntry ? winnerEntry[1] : 0,
  };
};

const buildLegacyBallot = (event = {}) => ({
  ballotId: 'main',
  name: event.name || 'Voting',
  description: event.description || '',
  selectedData: normalizeArrayField(event.selectedData, []),
  fileData: normalizeArrayField(event.fileData, []),
  candidateImages: normalizeArrayField(event.candidateImages, []),
});

const normalizeBallot = (ballot = {}, fallbackId = 'main') => ({
  ballotId: String(ballot.ballotId || ballot.id || fallbackId),
  name: String(ballot.name || ballot.title || 'Voting').trim(),
  description: String(ballot.description || '').trim(),
  selectedData: normalizeArrayField(ballot.selectedData, []),
  fileData: normalizeArrayField(ballot.fileData, []),
  candidateImages: normalizeArrayField(ballot.candidateImages, []),
});

const normalizeEventBallots = (event = {}) => {
  const ballots = Array.isArray(event.ballots) && event.ballots.length > 0
    ? event.ballots.map((ballot, index) =>
        normalizeBallot(ballot, `ballot-${index + 1}`),
      )
    : [buildLegacyBallot(event)];

  return ballots.map((ballot, index) => normalizeBallot(ballot, `ballot-${index + 1}`));
};

const getPrimaryBallot = (event = {}) => normalizeEventBallots(event)[0];

const getVoteEntries = (vote = {}) => {
  if (!vote || typeof vote !== 'object') return [];

  if (Array.isArray(vote.ballots) && vote.ballots.length > 0) {
    return vote.ballots.filter((entry) => entry && entry.ballotId);
  }

  if (vote.candidate) {
    return [
      {
        ballotId: 'main',
        candidate: vote.candidate,
        timestamp: vote.timestamp || new Date().toISOString(),
      },
    ];
  }

  return [];
};

const getVoteEntryMap = (vote = {}) =>
  getVoteEntries(vote).reduce((acc, entry) => {
    acc[String(entry.ballotId)] = entry;
    return acc;
  }, {});

const getEventVoteCount = (votes = []) =>
  votes.reduce((total, vote) => total + getVoteEntries(vote).length, 0);

const parseJsonArrayField = (value, fallback = []) => {
  if (value === undefined || value === null || value === '') return fallback;
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string') return fallback;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch (error) {
    return fallback;
  }
};

const normalizeArrayField = (value, fallback = []) => {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : fallback;
    } catch (error) {
      return fallback;
    }
  }
  return fallback;
};

const normalizeBallotPayload = (ballot = {}, fallbackId = 'main') => {
  const selectedData = Array.isArray(ballot.selectedData)
    ? ballot.selectedData
    : [];
  const fileData = Array.isArray(ballot.fileData) ? ballot.fileData : [];
  const candidateImages = Array.isArray(ballot.candidateImages)
    ? ballot.candidateImages
    : [];
  return {
    ballotId: String(ballot.ballotId || ballot.id || fallbackId).trim(),
    name: String(ballot.name || ballot.title || '').trim(),
    description: String(ballot.description || '').trim(),
    selectedData,
    fileData,
    candidateImages,
  };
};

const buildBallotPayloads = (reqBody = {}) => {
  const parsedBallots = parseJsonArrayField(reqBody.ballots, []);
  const fileData = parseJsonArrayField(reqBody.fileData, []);
  if (parsedBallots.length > 0) {
    return parsedBallots.map((ballot, index) =>
      normalizeBallotPayload(
        {
          ...ballot,
          fileData: Array.isArray(ballot.fileData) && ballot.fileData.length > 0
            ? ballot.fileData
            : fileData,
        },
        `ballot-${index + 1}`,
      ),
    );
  }

  const selectedData = parseJsonArrayField(reqBody.selectedData, []);
  const candidateImages = parseJsonArrayField(reqBody.candidateImages, []);
  return [
    normalizeBallotPayload(
      {
        ballotId: 'main',
        name: reqBody.name,
        description: reqBody.description,
        selectedData,
        fileData,
        candidateImages,
      },
      'main',
    ),
  ];
};

const resolveActor = async (requestUser = {}) => {
  if (requestUser.subUserId) {
    const subUser = await SubUser.findById(requestUser.subUserId).lean();
    return {
      id: String(requestUser.subUserId),
      name: subUser?.fullName || subUser?.email || 'Sub user',
      role: requestUser.subUserRole || subUser?.role || 'user',
      type: 'sub user',
    };
  }

  const user = requestUser.userId
    ? await User.findById(requestUser.userId).lean()
    : null;

  return {
    id: requestUser.userId ? String(requestUser.userId) : '',
    name: user?.name || user?.email || 'Admin',
    role: requestUser.role || user?.role || 'admin',
    type: 'user',
  };
};

const hasActorName = (actor) =>
  actor && typeof actor.name === 'string' && actor.name.trim().length > 0;

const withFallbackActor = (actor, fallbackActor) =>
  hasActorName(actor) ? actor : fallbackActor;

const toHistoryRecord = (event, votes, fallbackActor = null) => {
  const summary = getVoteSummary(votes);
  const status = getEventStatus(event);

  return {
    eventId: event.id,
    name: event.name,
    date: event.date,
    startTime: event.startTime,
    stopTime: event.stopTime,
    status,
    action: 'created',
    winner: summary.winner,
    totalVotes: summary.totalVotes,
    winnerVotes: summary.winnerVotes,
    resultDate: status === 'done' ? getResultDate(event) : null,
    createdAt: event.createdAt || null,
    deletedAt: null,
    deleteReason: null,
    createdBy: withFallbackActor(event.createdBy, fallbackActor),
    deletedBy: null,
  };
};

const serializeEventForResponse = (event, req = null) => {
  const normalizedEvent = normalizeCandidateImages(event);
  const ballots = normalizeEventBallots(normalizedEvent);
  const primaryBallot = ballots[0] || buildLegacyBallot(normalizedEvent);
  const fileData =
    Array.isArray(normalizedEvent.fileData) && normalizedEvent.fileData.length > 0
      ? normalizedEvent.fileData
      : Array.isArray(primaryBallot.fileData)
        ? primaryBallot.fileData
        : [];
  const votingWindow = getVotingWindow(normalizedEvent);

  return {
    ...normalizedEvent,
    name: primaryBallot.name || normalizedEvent.name,
    description: primaryBallot.description || normalizedEvent.description,
    selectedData: primaryBallot.selectedData || normalizedEvent.selectedData || [],
    fileData,
    candidateImages:
      primaryBallot.candidateImages ||
      normalizedEvent.candidateImages ||
      [],
    ballots,
    votingWindow: {
      phase: votingWindow.phase,
      isOpen: votingWindow.isOpen,
      message: votingWindow.message,
      startDateTime: votingWindow.startDateTime,
      originalEndDateTime: votingWindow.originalEndDateTime,
      effectiveEndDateTime: votingWindow.effectiveEndDateTime,
      bufferMinutes: votingWindow.bufferMinutes,
    },
    ...(req
      ? {
          votingAccess: null,
        }
      : {}),
  };
};

// Fetch all events for authenticated user
router.get('/events', authenticateToken, async (req, res) => {
  console.log('📥 Fetching all events for user:', req.user.userId);
  try {
    const events = await Event.find({ userId: req.user.userId });
    res
      .status(200)
      .json(events.map((event) => serializeEventForResponse(event)));
  } catch (error) {
    console.error('❌ Error fetching all events:', error);
    res
      .status(500)
      .json({ message: 'Failed to fetch all events', error: error.message });
  }
});

// Fetch active and deleted event history for authenticated user
router.get('/event-history', authenticateToken, async (req, res) => {
  try {
    const owner = await User.findById(req.user.userId).lean();
    const fallbackActor = {
      id: req.user.userId,
      name: owner?.name || owner?.email || 'Account admin',
      role: owner?.role || 'admin',
      type: 'user',
    };
    const events = await Event.find({ userId: req.user.userId }).sort({
      createdAt: -1,
    });
    const savedHistory = await EventHistory.find({ userId: req.user.userId })
      .sort({ createdAt: -1 })
      .lean();
    const savedCreatedEventIds = new Set(
      savedHistory
        .filter((event) => event.action === 'created')
        .map((event) => event.eventId),
    );

    const activeHistory = await Promise.all(
      events
        .filter((event) => !savedCreatedEventIds.has(event.id))
        .map(async (event) => {
          const votes = await Vote.find({ eventId: event.id }).lean();
          return toHistoryRecord(event, votes, fallbackActor);
        }),
    );

    const savedHistoryRecords = await Promise.all(
      savedHistory.map(async (event) => {
        const liveEvent = events.find((item) => item.id === event.eventId);
        // Try to load votes for the event (works even if Event doc was deleted)
        const votes = await Vote.find({ eventId: event.eventId }).lean();

        let summary;
        if (votes && votes.length > 0) {
          summary = getVoteSummary(votes);
        } else if (liveEvent) {
          const liveVotes = await Vote.find({ eventId: liveEvent.id }).lean();
          summary = getVoteSummary(liveVotes || []);
        } else {
          summary = {
            totalVotes: event.totalVotes || 0,
            winner: event.winner || 'No votes yet',
            winnerVotes: event.winnerVotes || 0,
          };
        }

        const status =
          event.action === 'deleted'
            ? 'deleted'
            : liveEvent
              ? getEventStatus(liveEvent)
              : event.status;

        return {
          eventId: event.eventId,
          name: liveEvent?.name || event.name,
          date: liveEvent?.date || event.date,
          startTime: liveEvent?.startTime || event.startTime,
          stopTime: liveEvent?.stopTime || event.stopTime,
          status,
          action:
            event.action ||
            (event.status === 'deleted' ? 'deleted' : 'created'),
          winner: summary.winner,
          totalVotes: summary.totalVotes,
          winnerVotes: summary.winnerVotes || 0,
          resultDate:
            status === 'done'
              ? getResultDate(liveEvent || event)
              : event.resultDate || event.deletedAt || null,
          createdAt: event.createdAt || null,
          deletedAt: event.deletedAt || null,
          createdBy: withFallbackActor(event.createdBy, fallbackActor),
          deletedBy: withFallbackActor(event.deletedBy, null),
        };
      }),
    );

    res.status(200).json(
      [...activeHistory, ...savedHistoryRecords].sort((a, b) => {
        const left = new Date(a.deletedAt || a.resultDate || a.createdAt || 0);
        const right = new Date(b.deletedAt || b.resultDate || b.createdAt || 0);
        return right - left;
      }),
    );
  } catch (error) {
    console.error('Error fetching event history:', error);
    res.status(500).json({
      message: 'Failed to fetch event history',
      error: error.message,
    });
  }
});

// Fetch votes for an event
router.get('/votes/:eventId', authenticateToken, async (req, res) => {
  console.log(
    '📥 Fetching votes for event:',
    req.params.eventId,
    'by user:',
    req.user.userId,
  );
  try {
    const event = await Event.findOne({
      id: req.params.eventId,
      userId: req.user.userId,
    });
    if (!event) {
      return res
        .status(403)
        .json({ message: 'Unauthorized or event not found' });
    }
    const votes = await Vote.find({ eventId: req.params.eventId });
    res.status(200).json(votes);
  } catch (error) {
    console.error('❌ Error fetching votes:', error);
    res
      .status(500)
      .json({ message: 'Failed to fetch votes', error: error.message });
  }
});

// Store Excel Data in Event
router.post(
  '/excel-data',
  authenticateToken,
  upload.none(),
  async (req, res) => {
    console.log('📥 Excel data submission received:', req.body);
    const { eventId, fileData, timestamp } = req.body;

    if (!eventId || !fileData || !timestamp) {
      return res.status(400).json({
        message: 'Missing required fields: eventId, fileData, timestamp',
      });
    }

    try {
      const event = await Event.findOneAndUpdate(
        { id: eventId, userId: req.user.userId },
        { $set: { fileData, timestamp } },
        { new: true },
      );

      if (!event) {
        return res
          .status(404)
          .json({ message: 'Event not found or unauthorized' });
      }

      console.log('✅ Excel data updated for event:', event);
      res.status(201).json({ message: 'Excel data updated successfully' });
    } catch (error) {
      console.error('❌ Error updating Excel data:', error);
      res
        .status(500)
        .json({ message: 'Failed to update Excel data', error: error.message });
    }
  },
);

// Verify ID
router.post('/verify-id/:eventId', upload.none(), async (req, res) => {
  console.log(
    '📥 ID verification request for event:',
    req.params.eventId,
    'ID:',
    req.body.id,
  );
  const id = String(req.body.id || '').trim();
  const eventId = req.params.eventId;

  if (!id) {
    return res.status(400).json({ message: 'ID is required' });
  }

  try {
    const event = await Event.findOne({ id: eventId });
    if (!event) {
      return res.status(404).json({ message: 'Voting event not found' });
    }

    const access = await getVotingAccess(event, req);
    if (!access.isOpen || !access.allowed) {
      return res.status(403).json({
        message: access.message,
        votingAccess: access,
      });
    }

    const fileData = normalizeArrayField(
      event.fileData && event.fileData.length ? event.fileData : event.ballots?.[0]?.fileData,
      [],
    );

    if (!Array.isArray(fileData) || fileData.length === 0) {
      return res
        .status(404)
        .json({ message: 'No voter list found for this event' });
    }

    const rowData = fileData.find((row) => {
      const values = Object.values(row);
      return values.length >= 2 && String(values[1]).trim() === id;
    });

    if (!rowData) {
      return res.status(200).json({
        message: 'ID not found in second column of Excel data',
        verified: false,
      });
    }

    const existingVote = await Vote.findOne({ eventId, voterId: id }).lean();
    const completedBallots = getVoteEntries(existingVote).map((entry) =>
      String(entry.ballotId),
    );
    const ballots = normalizeEventBallots(event);

    res.status(200).json({
      verified: true,
      rowData,
      hasVoted: completedBallots.length > 0,
      completedBallots,
      totalBallots: ballots.length,
      pendingBallots: ballots.filter(
        (ballot) => !completedBallots.includes(String(ballot.ballotId)),
      ),
    });
  } catch (error) {
    console.error('❌ Error verifying ID:', error);
    res
      .status(500)
      .json({ message: 'Failed to verify ID', error: error.message });
  }
});

// Submit Vote for a public voting session
router.post('/vote/:eventId', upload.none(), async (req, res) => {
  console.log(
    '📥 Vote submission for event:',
    req.params.eventId,
    'Data:',
    req.body,
  );
  const voterId = String(req.body.voterId || '').trim();
  const candidate = String(req.body.candidate || '').trim();
  const ballotId = String(req.body.ballotId || 'main').trim() || 'main';
  const eventId = req.params.eventId;

  if (!voterId || !candidate) {
    return res
      .status(400)
      .json({ message: 'Voter ID and candidate are required' });
  }

  try {
    const event = await Event.findOne({ id: eventId });
    if (!event) {
      return res.status(404).json({ message: 'Voting event not found' });
    }

    const access = await getVotingAccess(event, req);
    if (!access.isOpen || !access.allowed) {
      return res.status(403).json({
        message: access.message,
        votingAccess: access,
      });
    }

    const ballots = normalizeEventBallots(event);
    const ballot = ballots.find(
      (entry) => String(entry.ballotId) === ballotId,
    );
    if (!ballot) {
      return res.status(400).json({ message: 'Voting post not found' });
    }

    const candidateExists = Array.isArray(ballot.selectedData)
      ? ballot.selectedData.some((item) => {
          const label =
            item.Name ||
            item.name ||
            item.Candidate ||
            item.candidate ||
            '';
          return String(label).trim() === candidate;
        })
      : false;
    if (!candidateExists) {
      return res
        .status(400)
        .json({ message: 'Candidate is not part of this voting post' });
    }

    const existingVote = await Vote.findOne({ eventId, voterId });
    const existingEntries = getVoteEntryMap(existingVote || {});
    if (existingEntries[ballotId]) {
      return res
        .status(400)
        .json({ message: 'This ID has already voted in this post' });
    }

    const voteTimestamp = new Date().toISOString();
    const votePayload = existingVote || new Vote({ eventId, voterId, ballots: [] });
    votePayload.ballots = Array.isArray(votePayload.ballots)
      ? votePayload.ballots
      : [];
    votePayload.ballots.push({
      ballotId,
      candidate,
      timestamp: voteTimestamp,
    });
    votePayload.candidate = votePayload.ballots[0]?.candidate || candidate;
    votePayload.timestamp = votePayload.ballots[0]?.timestamp || voteTimestamp;

    await votePayload.save();
    console.log('Vote saved successfully:', votePayload);
    res.status(201).json({
      message: 'Vote submitted successfully',
      ballotId,
      completedBallots: getVoteEntries(votePayload).map((entry) =>
        String(entry.ballotId),
      ),
    });
  } catch (error) {
    console.error('Error saving vote:', error);
    if (error && error.code === 11000) {
      return res.status(400).json({ message: 'This ID has already voted' });
    }
    res
      .status(500)
      .json({ message: 'Failed to submit vote', error: error.message });
  }
});

// Get Event for authenticated admin/manage views
router.get('/events/:id', authenticateToken, async (req, res) => {
  console.log('Event fetch request for ID:', req.params.id);
  try {
    const event = await Event.findOne({
      id: req.params.id,
      userId: req.user.userId,
    });
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }
    res.status(200).json({
      ...serializeEventForResponse(event),
      votingAccess: await getVotingAccess(event, req),
    });
  } catch (error) {
    console.error('Error fetching event:', error);
    res
      .status(500)
      .json({ message: 'Failed to fetch event', error: error.message });
  }
});

// Get Event for public voting views
router.get('/public/events/:id', async (req, res) => {
  console.log('Public event fetch request for ID:', req.params.id);
  try {
    const event = await Event.findOne({ id: req.params.id });
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    const access = await getVotingAccess(event, req);
    if (access.phase === 'closed') {
      return res.status(403).json({
        message: 'Voting time is over.',
        votingAccess: access,
      });
    }

    return res.status(200).json({
      ...serializeEventForResponse(event),
      votingAccess: access,
    });
  } catch (error) {
    console.error('Error fetching public event:', error);
    return res
      .status(500)
      .json({ message: 'Failed to fetch event', error: error.message });
  }
});

// Debug: Return server-side computed voting window and server time for troubleshooting
router.get('/public/events/:id/debug', async (req, res) => {
  try {
    const event = await Event.findOne({ id: req.params.id }).lean();
    if (!event) return res.status(404).json({ message: 'Event not found' });

    const serverNow = new Date();
    const votingWindow = getVotingWindow(event, serverNow);
    const access = await getVotingAccess(event, req);

    return res.status(200).json({
      serverNow: serverNow.toString(),
      serverNowISO: serverNow.toISOString(),
      event: {
        id: event.id,
        date: event.date,
        startTime: event.startTime,
        stopTime: event.stopTime,
        startDateTimeRaw: event.startDateTime || null,
        originalEndDateTimeRaw: event.originalEndDateTime || null,
        bufferMinutes: event.bufferMinutes || 0,
      },
      votingWindow: {
        phase: votingWindow.phase,
        isOpen: votingWindow.isOpen,
        message: votingWindow.message,
        startDateTime: votingWindow.startDateTime
          ? votingWindow.startDateTime.toString()
          : null,
        startDateTimeISO: votingWindow.startDateTime
          ? votingWindow.startDateTime.toISOString()
          : null,
        originalEndDateTime: votingWindow.originalEndDateTime
          ? votingWindow.originalEndDateTime.toString()
          : null,
        originalEndDateTimeISO: votingWindow.originalEndDateTime
          ? votingWindow.originalEndDateTime.toISOString()
          : null,
        effectiveEndDateTime: votingWindow.effectiveEndDateTime
          ? votingWindow.effectiveEndDateTime.toString()
          : null,
        effectiveEndDateTimeISO: votingWindow.effectiveEndDateTime
          ? votingWindow.effectiveEndDateTime.toISOString()
          : null,
      },
      votingAccess: access,
      // Echo some request header info and connection addresses so we can see
      // what the server actually received from the client/proxy.
      requestInfo: {
        headers: {
          'x-forwarded-for': req.headers['x-forwarded-for'] || null,
          'x-real-ip': req.headers['x-real-ip'] || null,
          'cf-connecting-ip': req.headers['cf-connecting-ip'] || null,
          'true-client-ip': req.headers['true-client-ip'] || null,
          'x-client-ip': req.headers['x-client-ip'] || null,
        },
        expressIp: req.ip || null,
        connectionRemoteAddress:
          req.connection?.remoteAddress || req.socket?.remoteAddress || null,
      },
    });
  } catch (error) {
    console.error('Error fetching debug info for event:', error);
    return res
      .status(500)
      .json({ message: 'Failed to fetch debug info', error: error.message });
  }
});

// Public: Fetch buffer history for an event (buffer additions only)
router.get('/public/events/:id/history', async (req, res) => {
  try {
    const event = await Event.findOne({ id: req.params.id });
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    const history = await EventHistory.find({
      eventId: req.params.id,
      action: 'buffer-added',
    })
      .sort({ createdAt: -1 })
      .lean();

    const simplified = history.map((h) => ({
      bufferMinutes: h.bufferMinutes || 0,
      createdAt: h.createdAt,
      createdBy: h.createdBy || null,
    }));

    return res.status(200).json(simplified);
  } catch (error) {
    console.error('Error fetching public event history:', error);
    return res
      .status(500)
      .json({ message: 'Failed to fetch event history', error: error.message });
  }
});

// Create Event - only admin can create events
router.post(
  '/events',
  authenticateToken,
  requireManageAccess,
  upload.none(),
  async (req, res) => {
    console.log('📥 Event submission received:', req.body);
    if (!req.body || Object.keys(req.body).length === 0) {
      console.error('❌ Empty request body received');
      return res.status(400).json({ message: 'Request body is empty' });
    }

    const {
      id,
      date,
      startTime,
      stopTime,
      name,
      description,
      selectedData,
      candidateImages,
      expiry,
      link,
      fileData,
      ballots,
    } = req.body;

    const missingFields = [];
    if (!id) missingFields.push('id');
    if (!date) missingFields.push('date');
    if (!startTime) missingFields.push('startTime');
    if (!stopTime) missingFields.push('stopTime');
    if (!expiry) missingFields.push('expiry');
    if (!link) missingFields.push('link');

    if (missingFields.length > 0) {
      console.error('❌ Missing fields:', missingFields);
      return res.status(400).json({
        message: `Missing required fields: ${missingFields.join(', ')}`,
      });
    }

    try {
      const user = await User.findById(req.user.userId);
      if (!user) return res.status(404).json({ message: 'User not found' });

      const subscriptionExpired = normalizeSubscriptionForExpiry(
        user.subscription,
        new Date(),
      );
      if (subscriptionExpired) {
        await user.save();
      }

      const availableVotingCredits = getActiveRemainingCredits(
        user.subscription,
      );
      const parsedFileData = parseJsonArrayField(fileData, []);
      const ballotPayloads = buildBallotPayloads({
        ballots,
        selectedData,
        candidateImages,
        fileData: parsedFileData,
        name,
        description,
      });
      const primaryBallot = ballotPayloads[0] || {
        ballotId: 'main',
        name,
        description,
        selectedData: [],
        candidateImages: [],
      };
      const creditsNeeded = Math.max(1, ballotPayloads.length);

      if (!user.subscription?.isValid || availableVotingCredits < creditsNeeded) {
        return res.status(402).json({
          message:
            'Not enough voting credits available. Please buy more voting credits to create these voting posts.',
        });
      }

      if (!primaryBallot.name || !primaryBallot.description) {
        console.error('❌ Invalid ballot metadata:', primaryBallot);
        return res
          .status(400)
          .json({ message: 'Voting name and description are required' });
      }

      if (
        !Array.isArray(primaryBallot.selectedData) ||
        primaryBallot.selectedData.length === 0
      ) {
        console.error('❌ Invalid selectedData:', primaryBallot.selectedData);
        return res
          .status(400)
          .json({ message: 'selectedData must be a non-empty array' });
      }

      const startDateTime = getStartDateTime({ date, startTime });
      const originalEndDateTime = getOriginalEndDateTime({ date, stopTime });
      if (!startDateTime || !originalEndDateTime) {
        return res.status(400).json({
          message: 'Invalid event date or time values provided',
        });
      }

      if (startDateTime >= originalEndDateTime) {
        return res.status(400).json({
          message: 'End time must be greater than start time',
        });
      }

      const actor = await resolveActor(req.user);
      const event = new Event({
        id,
        userId: req.user.userId,
        date,
        startTime,
        stopTime,
        name: primaryBallot.name,
        description: primaryBallot.description,
        startDateTime,
        endDateTime: originalEndDateTime,
        originalEndDateTime,
        bufferMinutes: 0,
        selectedData: primaryBallot.selectedData,
        fileData: parsedFileData,
        candidateImages: primaryBallot.candidateImages,
        ballots: ballotPayloads.map((ballot, index) =>
          normalizeBallotPayload(ballot, `ballot-${index + 1}`),
        ),
        expiry: originalEndDateTime.getTime(),
        link,
        createdBy: actor,
      });

      await event.validate();
      await event.save();
      user.subscription.votingCredits = availableVotingCredits - creditsNeeded;
      user.subscription.usedVotingCredits =
        (user.subscription.usedVotingCredits || 0) + creditsNeeded;
      user.subscription.isValid = user.subscription.votingCredits > 0;
      try {
        await user.save();
      } catch (saveError) {
        console.error(
          '❌ Failed to deduct voting credit after creating event, rolling back event:',
          saveError,
        );
        await Event.deleteOne({ _id: event._id });
        return res.status(500).json({
          message: 'Failed to deduct voting credit after event creation',
          error: saveError.message,
        });
      }
      console.log('✅ Event saved successfully:', event);
      await EventHistory.create({
        eventId: event.id,
        userId: req.user.userId,
        name: event.name,
        date: event.date,
        startTime: event.startTime,
        stopTime: event.stopTime,
        status: getEventStatus(event),
        action: 'created',
        winner: 'No votes yet',
        totalVotes: 0,
        winnerVotes: 0,
        resultDate: null,
        createdBy: actor,
      });
      res.status(201).json({
        message: 'Event created successfully',
        link: event.link,
        remainingVotingCredits: user.subscription.votingCredits,
        ballotsCreated: ballotPayloads.length,
      });
    } catch (error) {
      console.error('❌ Error saving event:', error);
      res
        .status(500)
        .json({ message: 'Failed to create event', error: error.message });
    }
  },
);

// Authenticated: Fetch history for a specific event (all history items for owner)
router.get('/events/:id/history', authenticateToken, async (req, res) => {
  try {
    const event = await Event.findOne({
      id: req.params.id,
      userId: req.user.userId,
    });
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    const history = await EventHistory.find({
      eventId: req.params.id,
      userId: req.user.userId,
    })
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json(history);
  } catch (error) {
    console.error('Error fetching event history for owner:', error);
    return res
      .status(500)
      .json({ message: 'Failed to fetch event history', error: error.message });
  }
});

// Update Event - only admin
router.put(
  '/events/:id',
  authenticateToken,
  requireManageAccess,
  upload.none(),
  async (req, res) => {
    console.log(
      '📥 Event update request for ID:',
      req.params.id,
      'Data:',
      req.body,
    );
    if (!req.body || Object.keys(req.body).length === 0) {
      console.error('❌ Empty request body received');
      return res.status(400).json({ message: 'Request body is empty' });
    }

    const {
      date,
      startTime,
      stopTime,
      name,
      description,
      selectedData,
      candidateImages,
      expiry,
      link,
      fileData,
      ballots,
    } = req.body;

    const missingFields = [];
    if (!date) missingFields.push('date');
    if (!startTime) missingFields.push('startTime');
    if (!stopTime) missingFields.push('stopTime');
    if (!name) missingFields.push('name');
    if (!description) missingFields.push('description');
    if (!selectedData) missingFields.push('selectedData');
    if (!expiry) missingFields.push('expiry');
    if (!link) missingFields.push('link');

    if (missingFields.length > 0) {
      console.error('❌ Missing fields:', missingFields);
      return res.status(400).json({
        message: `Missing required fields: ${missingFields.join(', ')}`,
      });
    }

    try {
      let parsedSelectedData, parsedCandidateImages, parsedFileData, parsedBallots;
      try {
        parsedSelectedData = JSON.parse(selectedData);
        parsedCandidateImages = candidateImages
          ? JSON.parse(candidateImages)
          : [];
        parsedFileData = parseJsonArrayField(fileData, []);
        parsedBallots = ballots ? JSON.parse(ballots) : [];
      } catch (error) {
        console.error('❌ JSON parsing error:', error);
        return res.status(400).json({
          message:
            'Invalid JSON format in selectedData, candidateImages, fileData, or ballots',
        });
      }

      let updateName = name;
      let updateDescription = description;
      if (Array.isArray(parsedBallots) && parsedBallots.length > 0) {
        const primaryBallot = normalizeBallotPayload(
          {
            ...parsedBallots[0],
            fileData:
              Array.isArray(parsedBallots[0].fileData) &&
              parsedBallots[0].fileData.length > 0
                ? parsedBallots[0].fileData
                : parsedFileData,
          },
          'main',
        );
        parsedSelectedData = primaryBallot.selectedData;
        parsedCandidateImages = primaryBallot.candidateImages;
        parsedFileData =
          Array.isArray(parsedFileData) && parsedFileData.length > 0
            ? parsedFileData
            : primaryBallot.fileData || [];
        updateName = primaryBallot.name || name;
        updateDescription = primaryBallot.description || description;
      }

      if (
        !Array.isArray(parsedSelectedData) ||
        parsedSelectedData.length === 0
      ) {
        console.error('❌ Invalid selectedData:', parsedSelectedData);
        return res
          .status(400)
          .json({ message: 'selectedData must be a non-empty array' });
      }

      const existingEvent = await Event.findOne({
        id: req.params.id,
        userId: req.user.userId,
      });
      if (!existingEvent) {
        console.error(
          '❌ Event not found or unauthorized for ID:',
          req.params.id,
        );
        return res
          .status(404)
          .json({ message: 'Event not found or unauthorized' });
      }

      const existingStartDateTime =
        existingEvent.startDateTime ||
        getStartDateTime(existingEvent) ||
        parseLocalDateTime(existingEvent.date, existingEvent.startTime);
      const now = new Date();
      if (existingStartDateTime && now >= new Date(existingStartDateTime)) {
        return res.status(400).json({
          message: 'Event has already started and cannot be edited',
        });
      }

      const nextStartDateTime = getStartDateTime({ date, startTime });
      const nextEndDateTime = getOriginalEndDateTime({ date, stopTime });
      if (!nextStartDateTime || !nextEndDateTime) {
        return res.status(400).json({
          message: 'Invalid event date or time values provided',
        });
      }
      if (nextStartDateTime >= nextEndDateTime) {
        return res.status(400).json({
          message: 'End time must be greater than start time',
        });
      }
      const currentBufferMinutes = Number(existingEvent.bufferMinutes || 0);
      const effectiveEndDateTime = new Date(
        nextEndDateTime.getTime() + currentBufferMinutes * 60 * 1000,
      );
      const existingBallotCount = Math.max(
        1,
        Array.isArray(existingEvent.ballots) ? existingEvent.ballots.length : 0,
      );
      const updatedBallotCount = Math.max(
        1,
        Array.isArray(parsedBallots) ? parsedBallots.length : 0,
      );
      const creditsToDeduct = Math.max(
        0,
        updatedBallotCount - existingBallotCount,
      );
      const restoreEventData = existingEvent.toObject();
      delete restoreEventData._id;
      delete restoreEventData.__v;
      let creditUser = null;
      let availableVotingCredits = 0;
      if (creditsToDeduct > 0) {
        creditUser = await User.findById(req.user.userId);
        if (!creditUser) {
          return res.status(404).json({ message: 'User not found' });
        }

        const subscriptionExpired = normalizeSubscriptionForExpiry(
          creditUser.subscription,
          new Date(),
        );
        if (subscriptionExpired) {
          await creditUser.save();
        }

        availableVotingCredits = getActiveRemainingCredits(
          creditUser.subscription,
        );
        if (
          !creditUser.subscription?.isValid ||
          availableVotingCredits < creditsToDeduct
        ) {
          return res.status(402).json({
            message:
              'Not enough voting credits available to add more voting posts.',
          });
        }
      }

      // Identify images to delete (supports S3 keys or legacy UUID fields)
      const existingImageKeys = new Set(
        existingEvent.candidateImages
          .map((img) => img.key || img.s3Key || img.url || img.uuid)
          .filter(Boolean),
      );
      const newImageKeys = new Set(
        parsedCandidateImages
          .map((img) => img.key || img.s3Key || img.url || img.uuid)
          .filter(Boolean),
      );
      const imagesToDelete = [...existingImageKeys].filter(
        (k) => !newImageKeys.has(k),
      );

      // Delete images from S3 when configured
      if (imagesToDelete.length > 0 && process.env.AWS_BUCKET_NAME) {
        const s3 = new S3Client({
          region: process.env.AWS_REGION,
          credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
          },
        });

        const extractKey = (val) => {
          // If URL, try to extract key after bucket domain
          try {
            if (val.startsWith('http')) {
              const parts = val.split('/');
              return parts.slice(3).join('/');
            }
            return val;
          } catch (e) {
            return val;
          }
        };

        try {
          await Promise.all(
            imagesToDelete.map(async (val) => {
              const key = extractKey(val);
              await s3.send(
                new DeleteObjectCommand({
                  Bucket: process.env.AWS_BUCKET_NAME,
                  Key: key,
                }),
              );
              console.log(`🗑️ Deleted image from S3: ${key}`);
            }),
          );
        } catch (err) {
          console.error(
            '❌ Error deleting images from S3:',
            err.message || err,
          );
        }
      } else if (imagesToDelete.length > 0) {
        console.warn(
          '⚠️ AWS_BUCKET_NAME not configured — skipping image deletions',
        );
      }

      const event = await Event.findOneAndUpdate(
        { id: req.params.id, userId: req.user.userId },
        {
          date,
          startTime,
          stopTime,
          name: updateName,
          description: updateDescription,
          startDateTime: nextStartDateTime,
          endDateTime: effectiveEndDateTime,
          originalEndDateTime: nextEndDateTime,
          bufferMinutes: currentBufferMinutes,
          selectedData: parsedSelectedData,
          fileData: parsedFileData,
          candidateImages: parsedCandidateImages,
          ballots: Array.isArray(parsedBallots)
            ? parsedBallots.map((ballot, index) =>
                normalizeBallotPayload(
                  {
                    ...ballot,
                    fileData:
                      Array.isArray(ballot.fileData) &&
                      ballot.fileData.length > 0
                        ? ballot.fileData
                        : parsedFileData,
                  },
                  `ballot-${index + 1}`,
                ),
              )
            : [],
          expiry: effectiveEndDateTime.getTime(),
          link,
        },
        { new: true, runValidators: true },
      );

      if (!event) {
        console.error('❌ Event not found for ID:', req.params.id);
        return res.status(404).json({ message: 'Event not found' });
      }

      console.log('✅ Event updated successfully:', event);
      if (creditsToDeduct > 0 && creditUser) {
        creditUser.subscription.votingCredits =
          availableVotingCredits - creditsToDeduct;
        creditUser.subscription.usedVotingCredits =
          (creditUser.subscription.usedVotingCredits || 0) + creditsToDeduct;
        creditUser.subscription.isValid =
          creditUser.subscription.votingCredits > 0;

        try {
          await creditUser.save();
        } catch (saveError) {
          console.error(
            'Failed to deduct voting credits after updating event, rolling back event:',
            saveError,
          );
          await Event.updateOne(
            { id: req.params.id, userId: req.user.userId },
            { $set: restoreEventData },
          );
          return res.status(500).json({
            message: 'Failed to deduct voting credits after event update',
            error: saveError.message,
          });
        }
      }
      res
        .status(200)
        .json({
          message: 'Event updated successfully',
          link: event.link,
          creditsDeducted: creditsToDeduct,
        });
    } catch (error) {
      console.error('❌ Error updating event:', error);
      res
        .status(500)
        .json({ message: 'Failed to update event', error: error.message });
    }
  },
);

// Add Buffer Time - only super admin
router.patch(
  '/events/:id/buffer-time',
  authenticateToken,
  requireSuperAdmin,
  upload.none(),
  async (req, res) => {
    console.log(
      '📥 Buffer time request for ID:',
      req.params.id,
      'Data:',
      req.body,
    );

    const totalBufferMinutes = 15;

    try {
      const event = await Event.findOne({
        id: req.params.id,
        userId: req.user.userId,
      });

      if (!event) {
        return res
          .status(404)
          .json({ message: 'Event not found or unauthorized' });
      }

      // Allow multiple buffer additions. We'll accumulate buffer minutes.

      const bufferCheck = canAddBufferTime(event, new Date());
      if (!bufferCheck.allowed) {
        return res.status(400).json({ message: bufferCheck.message });
      }

      const currentEndDateTime = getEffectiveEndDateTime(event);
      if (!currentEndDateTime) {
        return res.status(400).json({
          message: 'Unable to determine the voting end time',
        });
      }

      const effectiveEndDateTime = new Date(
        currentEndDateTime.getTime() + totalBufferMinutes * 60 * 1000,
      );
      const now = new Date();
      const newBufferMinutes = Number(event.bufferMinutes || 0) + totalBufferMinutes;

      // Validate that the resulting time is in the future
      if (now >= effectiveEndDateTime) {
        return res.status(400).json({
          message:
            'Buffer time is too small. Please choose a larger duration so the voting remains open.',
        });
      }

      // Ensure the effective end time is on the same calendar day as the original event
      if (!isSameCalendarDay(effectiveEndDateTime, currentEndDateTime)) {
        return res.status(400).json({
          message:
            'Buffer time cannot extend voting beyond the current calendar day. Please choose a smaller duration.',
        });
      }

      const formattedStopTime = formatTimeInTimeZone(effectiveEndDateTime);

      const updatedEvent = await Event.findOneAndUpdate(
        { id: req.params.id, userId: req.user.userId },
        {
          bufferMinutes: newBufferMinutes,
          bufferAddedAt: now,
          bufferAddedBy: await resolveActor(req.user),
          endDateTime: effectiveEndDateTime,
          expiry: effectiveEndDateTime.getTime(),
          stopTime: formattedStopTime,
        },
        { new: true, runValidators: true },
      );

      // Record buffer addition in event history
      try {
        const actor = await resolveActor(req.user);
        await EventHistory.create({
          eventId: updatedEvent.id,
          userId: req.user.userId,
          name: updatedEvent.name,
          date: updatedEvent.date,
          startTime: updatedEvent.startTime,
          stopTime: updatedEvent.stopTime,
          status: getEventStatus(updatedEvent),
          action: 'buffer-added',
          bufferMinutes: Number(totalBufferMinutes || 0),
          createdBy: actor,
        });
      } catch (histErr) {
        console.error(
          '❌ Failed to write event history for buffer addition:',
          histErr,
        );
      }

      return res.status(200).json({
        message: 'Buffer time added successfully',
        event: serializeEventForResponse(updatedEvent),
      });
    } catch (error) {
      console.error('❌ Error adding buffer time:', error);
      return res.status(500).json({
        message: 'Failed to add buffer time',
        error: error.message,
      });
    }
  },
);

// Delete Event - only admin
router.delete(
  '/events/:id',
  authenticateToken,
  requireManageAccess,
  async (req, res) => {
    console.log(
      '📥 Event deletion request for ID:',
      req.params.id,
      'by user:',
      req.user.userId,
    );
    try {
      const event = await Event.findOne({
        id: req.params.id,
        userId: req.user.userId,
      });
      if (!event) {
        console.error(
          '❌ Event not found or unauthorized for ID:',
          req.params.id,
        );
        return res
          .status(404)
          .json({ message: 'Event not found or unauthorized' });
      }

      const eventStartTime = getStartDateTime(event);
      const currentTime = new Date();
      const shouldRestoreCredit =
        eventStartTime instanceof Date && currentTime < eventStartTime;
      const creditsToRestore = Math.max(
        1,
        Array.isArray(event.ballots) ? event.ballots.length : 0,
      );
      let restoredCredit = false;
      const votes = await Vote.find({ eventId: req.params.id }).lean();
      const voteSummary = getVoteSummary(votes);
      const resultDate = getResultDate(event);
      const actor = await resolveActor(req.user);

      // Delete images from S3 when configured
      if (event.candidateImages && event.candidateImages.length > 0) {
        const values = event.candidateImages
          .map((img) => img.key || img.s3Key || img.url || img.uuid)
          .filter(Boolean);
        if (values.length > 0 && process.env.AWS_BUCKET_NAME) {
          const s3 = new S3Client({
            region: process.env.AWS_REGION,
            credentials: {
              accessKeyId: process.env.AWS_ACCESS_KEY_ID,
              secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
            },
          });

          const extractKey = (val) => {
            if (val && val.startsWith('http')) {
              const parts = val.split('/');
              return parts.slice(3).join('/');
            }
            return val;
          };

          try {
            await Promise.all(
              values.map(async (val) => {
                const key = extractKey(val);
                await s3.send(
                  new DeleteObjectCommand({
                    Bucket: process.env.AWS_BUCKET_NAME,
                    Key: key,
                  }),
                );
                console.log(`🗑️ Deleted image from S3: ${key}`);
              }),
            );
          } catch (err) {
            console.error(
              '❌ Error deleting images from S3:',
              err.message || err,
            );
          }
        } else if (values.length > 0) {
          console.warn(
            '⚠️ AWS_BUCKET_NAME not configured — skipping image deletions',
          );
        }
      }

      await Event.findOneAndDelete({
        id: req.params.id,
        userId: req.user.userId,
      });
      const deleteReason =
        typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
      await EventHistory.findOneAndUpdate(
        {
          eventId: event.id,
          userId: req.user.userId,
          action: 'deleted',
        },
        {
          eventId: event.id,
          userId: req.user.userId,
          name: event.name,
          date: event.date,
          startTime: event.startTime,
          stopTime: event.stopTime,
          status: 'deleted',
          action: 'deleted',
          winner: voteSummary.winner,
          totalVotes: voteSummary.totalVotes,
          winnerVotes: voteSummary.winnerVotes || 0,
          resultDate,
          deletedAt: new Date(),
          deleteReason: deleteReason || null,
          createdBy: event.createdBy || null,
          deletedBy: actor,
        },
        { upsert: true, new: true },
      );
      await Vote.deleteMany({ eventId: req.params.id });
      console.log(`🗑️ Deleted votes for event: ${req.params.id}`);

      if (shouldRestoreCredit) {
        const user = await User.findById(req.user.userId);
        if (user && user.subscription) {
          const subscriptionExpired = normalizeSubscriptionForExpiry(
            user.subscription,
            new Date(),
          );
          if (subscriptionExpired) {
            await user.save();
          } else {
            user.subscription.votingCredits =
              (user.subscription.votingCredits || 0) + creditsToRestore;
            user.subscription.usedVotingCredits = Math.max(
              0,
              (user.subscription.usedVotingCredits || 0) - creditsToRestore,
            );
            user.subscription.isValid = user.subscription.votingCredits > 0;
            await user.save();
            restoredCredit = true;
          }
        }
      }

      console.log('✅ Event and associated data deleted successfully');
      res.status(200).json({
        message: 'Event deleted successfully',
        creditRestored: restoredCredit,
        restoredCredits: restoredCredit ? creditsToRestore : 0,
      });
    } catch (error) {
      console.error('❌ Error deleting event:', error);
      res
        .status(500)
        .json({ message: 'Failed to delete event', error: error.message });
    }
  },
);

module.exports = router;
