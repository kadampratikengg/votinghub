const mongoose = require('mongoose');

const eventHistorySchema = new mongoose.Schema(
  {
    eventId: { type: String, required: true },
    userId: { type: String, required: true },
    name: { type: String, required: true },
    date: { type: String },
    startTime: { type: String },
    stopTime: { type: String },
    status: {
      type: String,
      enum: ['active', 'done', 'deleted'],
      default: 'active',
    },
    action: {
      type: String,
      enum: ['created', 'deleted', 'buffer-added'],
      default: 'created',
    },
    bufferMinutes: { type: Number },
    winner: { type: String },
    totalVotes: { type: Number, default: 0 },
    winnerVotes: { type: Number, default: 0 },
    resultDate: { type: Date },
    deletedAt: { type: Date },
    createdBy: {
      id: { type: String },
      name: { type: String },
      role: { type: String },
      type: { type: String },
    },
    deletedBy: {
      id: { type: String },
      name: { type: String },
      role: { type: String },
      type: { type: String },
    },
  },
  { timestamps: true },
);

eventHistorySchema.index({ userId: 1, eventId: 1, status: 1 });

module.exports = mongoose.model('EventHistory', eventHistorySchema);
