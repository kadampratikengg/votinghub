const mongoose = require('mongoose');

const voteSchema = new mongoose.Schema({
  eventId: { type: String, required: true },
  voterId: { type: String, required: true },
  candidate: { type: String, required: false },
  timestamp: { type: String, required: false },
  ballots: [
    {
      ballotId: { type: String, required: true },
      candidate: { type: String, required: true },
      timestamp: { type: String, required: true },
    },
  ],
});

voteSchema.index({ eventId: 1, voterId: 1 }, { unique: true });

module.exports = mongoose.model('Vote', voteSchema);
