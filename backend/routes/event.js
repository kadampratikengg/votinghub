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

const getRequestIp = (req) => {
  const forwardedFor = req.headers['x-forwarded-for'];
  if (typeof forwardedFor === 'string' && forwardedFor.trim()) {
    return normalizeIp(forwardedFor.split(',')[0]);
  }

  return normalizeIp(
    req.ip ||
      req.connection?.remoteAddress ||
      req.socket?.remoteAddress ||
      req.connection?.socket?.remoteAddress ||
      '',
  );
};

const formatIpRestrictionMessage = (user, requestIp) => {
  const allowedIp = normalizeIp(user?.allowedIp);
  const enabled = !!user?.ipRestrictionEnabled;

  if (!enabled) {
    return {
      enabled: false,
      allowedIp,
      requestIp,
      allowed: true,
      message: 'IP restriction is disabled for this voting link.',
    };
  }

  if (!allowedIp) {
    return {
      enabled: true,
      allowedIp: '',
      requestIp,
      allowed: false,
      message:
        'IP restriction is enabled, but no allowed IP address has been configured yet.',
    };
  }

  const allowed = requestIp === allowedIp;
  return {
    enabled: true,
    allowedIp,
    requestIp,
    allowed,
    message: allowed
      ? `IP restriction is enabled. Only ${allowedIp} can open this voting link.`
      : `Access denied from ${requestIp || 'unknown IP'}. Only ${allowedIp} can open this voting link.`,
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

  const owner = await User.findById(event.userId)
    .select('ipRestrictionEnabled allowedIp')
    .lean();

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

const formatTimeHHMM = (date) =>
  date instanceof Date && !Number.isNaN(date.getTime())
    ? date.toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      })
    : '';

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
  const counts = votes.reduce((acc, vote) => {
    acc[vote.candidate] = (acc[vote.candidate] || 0) + 1;
    return acc;
  }, {});

  const winnerEntry = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];

  return {
    totalVotes: votes.length,
    winner: winnerEntry ? winnerEntry[0] : 'No votes yet',
    winnerVotes: winnerEntry ? winnerEntry[1] : 0,
  };
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
    createdBy: withFallbackActor(event.createdBy, fallbackActor),
    deletedBy: null,
  };
};

const serializeEventForResponse = (event, req = null) => {
  const normalizedEvent = normalizeCandidateImages(event);
  const votingWindow = getVotingWindow(normalizedEvent);

  return {
    ...normalizedEvent,
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

    if (!event.fileData) {
      return res
        .status(404)
        .json({ message: 'No Excel data found for this event' });
    }

    const rowData = event.fileData.find((row) => {
      const values = Object.values(row);
      return values.length >= 2 && String(values[1]).trim() === id;
    });

    if (!rowData) {
      return res.status(200).json({
        message: 'ID not found in second column of Excel data',
        verified: false,
      });
    }

    const existingVote = await Vote.findOne({ eventId, voterId: id });
    const hasVoted = !!existingVote;

    res.status(200).json({ verified: true, rowData, hasVoted });
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

    const existingVote = await Vote.findOne({ eventId, voterId });
    if (existingVote) {
      return res.status(400).json({ message: 'This ID has already voted' });
    }

    const vote = new Vote({
      eventId,
      voterId,
      candidate,
      timestamp: new Date().toISOString(),
    });

    await vote.save();
    console.log('Vote saved successfully:', vote);
    res.status(201).json({ message: 'Vote submitted successfully' });
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
    } = req.body;

    const missingFields = [];
    if (!id) missingFields.push('id');
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
      if (!user.subscription?.isValid || availableVotingCredits <= 0) {
        return res.status(402).json({
          message:
            'No voting credits available. Please buy voting credits to create a new voting event.',
        });
      }

      let parsedSelectedData, parsedCandidateImages, parsedFileData;
      try {
        parsedSelectedData = JSON.parse(selectedData);
        parsedCandidateImages = candidateImages
          ? JSON.parse(candidateImages)
          : [];
        parsedFileData = fileData ? JSON.parse(fileData) : [];
      } catch (error) {
        console.error('❌ JSON parsing error:', error);
        return res.status(400).json({
          message:
            'Invalid JSON format in selectedData, candidateImages, or fileData',
        });
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
        name,
        description,
        startDateTime,
        endDateTime: originalEndDateTime,
        originalEndDateTime,
        bufferMinutes: 0,
        selectedData: parsedSelectedData,
        fileData: parsedFileData,
        candidateImages: parsedCandidateImages,
        expiry: originalEndDateTime.getTime(),
        link,
        createdBy: actor,
      });

      await event.validate();
      await event.save();
      user.subscription.votingCredits = availableVotingCredits - 1;
      user.subscription.usedVotingCredits =
        (user.subscription.usedVotingCredits || 0) + 1;
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
      let parsedSelectedData, parsedCandidateImages, parsedFileData;
      try {
        parsedSelectedData = JSON.parse(selectedData);
        parsedCandidateImages = candidateImages
          ? JSON.parse(candidateImages)
          : [];
        parsedFileData = fileData ? JSON.parse(fileData) : [];
      } catch (error) {
        console.error('❌ JSON parsing error:', error);
        return res.status(400).json({
          message:
            'Invalid JSON format in selectedData, candidateImages, or fileData',
        });
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
          name,
          description,
          startDateTime: nextStartDateTime,
          endDateTime: effectiveEndDateTime,
          originalEndDateTime: nextEndDateTime,
          bufferMinutes: currentBufferMinutes,
          selectedData: parsedSelectedData,
          fileData: parsedFileData,
          candidateImages: parsedCandidateImages,
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
      res
        .status(200)
        .json({ message: 'Event updated successfully', link: event.link });
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

    const hours = Number(req.body.hours || 0);
    const minutes = Number(req.body.minutes || 0);
    const totalBufferMinutes = hours * 60 + minutes;

    if (
      !Number.isFinite(hours) ||
      !Number.isFinite(minutes) ||
      hours < 0 ||
      minutes < 0 ||
      minutes >= 60 ||
      totalBufferMinutes <= 0
    ) {
      return res.status(400).json({
        message: 'Please choose a valid buffer duration',
      });
    }

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

      const originalEndDateTime =
        getOriginalEndDateTime(event) || getEffectiveEndDateTime(event);
      if (!originalEndDateTime) {
        return res.status(400).json({
          message: 'Unable to determine the voting end time',
        });
      }

      // accumulate existing buffer minutes (if any)
      const existingBuffer = Number(event.bufferMinutes || 0);
      const newBufferMinutes = existingBuffer + totalBufferMinutes;

      const effectiveEndDateTime = new Date(
        originalEndDateTime.getTime() + newBufferMinutes * 60 * 1000,
      );
      const now = new Date();

      // Validate that the resulting time is in the future
      if (now >= effectiveEndDateTime) {
        return res.status(400).json({
          message:
            'Buffer time is too small. Please choose a larger duration so the voting remains open.',
        });
      }

      // Ensure the effective end time is on the same calendar day as the original event
      if (!isSameCalendarDay(effectiveEndDateTime, originalEndDateTime)) {
        return res.status(400).json({
          message:
            'Buffer time cannot extend voting beyond the current calendar day. Please choose a smaller duration.',
        });
      }

      const formattedStopTime = formatTimeHHMM(effectiveEndDateTime);

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

      const eventStartTime = new Date(`${event.date}T${event.startTime}`);
      const currentTime = new Date();
      const shouldRestoreCredit = currentTime < eventStartTime;
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
              (user.subscription.votingCredits || 0) + 1;
            user.subscription.usedVotingCredits = Math.max(
              0,
              (user.subscription.usedVotingCredits || 0) - 1,
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
