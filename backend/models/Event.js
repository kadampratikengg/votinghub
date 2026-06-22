const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    userId: { type: String, required: true },
    date: { type: String, required: true },
    startTime: { type: String, required: true },
    stopTime: { type: String, required: true },
    name: { type: String, required: true },
    description: { type: String, required: true },
    startDateTime: { type: Date },
    endDateTime: { type: Date },
    originalEndDateTime: { type: Date },
    bufferMinutes: { type: Number, default: 0 },
    bufferAddedAt: { type: Date },
    bufferAddedBy: {
      id: { type: String },
      name: { type: String },
      role: { type: String },
      type: { type: String },
    },
    selectedData: [
      {
        type: mongoose.Schema.Types.Mixed,
        required: true,
      },
    ],
    fileData: { type: Array, required: false, default: [] },
    candidateImages: [
      {
        candidateIndex: Number,
        fileRowIndex: Number,
        selectedIndex: Number,
        key: String, // S3 object key
        url: String, // public URL for the object
      },
    ],
    ballots: [
      {
        ballotId: { type: String, required: true },
        name: { type: String, required: true },
        description: { type: String, required: true },
        selectedData: [
          {
            type: mongoose.Schema.Types.Mixed,
            required: true,
          },
        ],
        fileData: { type: Array, required: false, default: [] },
        candidateImages: [
          {
            candidateIndex: Number,
            fileRowIndex: Number,
            selectedIndex: Number,
            key: String,
            url: String,
          },
        ],
      },
    ],
    expiry: { type: Number, required: true },
    link: { type: String, required: true },
    createdBy: {
      id: { type: String },
      name: { type: String },
      role: { type: String },
      type: { type: String },
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model('Event', eventSchema);
