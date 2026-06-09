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
const {
  getIpRestrictionSettings,
} = require('../utils/ipRestrictionStore');
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

const getVotingOwnerAccess = async (event, req) => {
  const requestIp = getRequestIp(req);
  if (!event?.userId) {
    return {
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
          persistedIpSettings.ipRestrictionEnabled ?? owner?.ipRestrictionEnabled,
        allowedIp:
          persistedIpSettings.allowedIp !== undefined
            ? persistedIpSettings.allowedIp
            : owner?.allowedIp,
      }
    : owner;

  return formatIpRestrictionMessage(resolvedOwner, requestIp);
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
  const endTime = Number(event.expiry);
  if (Number.isFinite(endTime) && Date.now() > endTime) return 'done';
  return 'active';
};

const getResultDate = (event) => {
  const endTime = Number(event.expiry);
  if (Number.isFinite(endTime)) return new Date(endTime);
  const stopDate = new Date(`${event.date}T${event.stopTime}`);
  return Number.isNaN(stopDate.getTime()) ? null : stopDate;
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

// Fetch all events for authenticated user
router.get('/events', authenticateToken, async (req, res) => {
  console.log('📥 Fetching all events for user:', req.user.userId);
  try {
    const events = await Event.find({ userId: req.user.userId });
    res.status(200).json(events.map(normalizeCandidateImages));
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

    const access = await getVotingOwnerAccess(event, req);
    if (!access.allowed) {
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

    const access = await getVotingOwnerAccess(event, req);
    if (!access.allowed) {
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

// Get Event
router.get('/events/:id', async (req, res) => {
  console.log('Event fetch request for ID:', req.params.id);
  try {
    const event = await Event.findOne({ id: req.params.id });
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }
    const access = await getVotingOwnerAccess(event, req);
    if (!access.allowed) {
      return res.status(403).json({
        message: access.message,
        votingAccess: access,
      });
    }

    res.status(200).json({
      ...normalizeCandidateImages(event),
      votingAccess: access,
    });
  } catch (error) {
    console.error('Error fetching event:', error);
    res
      .status(500)
      .json({ message: 'Failed to fetch event', error: error.message });
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

      const actor = await resolveActor(req.user);
      const event = new Event({
        id,
        userId: req.user.userId,
        date,
        startTime,
        stopTime,
        name,
        description,
        selectedData: parsedSelectedData,
        fileData: parsedFileData,
        candidateImages: parsedCandidateImages,
        expiry: Number(expiry),
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
          selectedData: parsedSelectedData,
          fileData: parsedFileData,
          candidateImages: parsedCandidateImages,
          expiry: Number(expiry),
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
