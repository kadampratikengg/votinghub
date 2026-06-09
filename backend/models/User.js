const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  username: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  organization: { type: String },
  logo: { type: String }, // Stores S3 object key or public URL for the logo
  contact: { type: String },
  phone: { type: String },
  address: { type: String },
  state: { type: String },
  district: { type: String },
  pincode: { type: String },
  gstNumber: { type: String },
  ipRestrictionEnabled: { type: Boolean, default: false },
  allowedIp: { type: String, default: '' },
  role: { type: String, enum: ['admin', 'subuser'], default: 'admin' },
  subscription: {
    planDuration: { type: String },
    startDate: { type: Date },
    endDate: { type: Date },
    isValid: { type: Boolean, default: false },
    votingCredits: { type: Number, default: 0 },
    activationDate: { type: Date },
    usedVotingCredits: { type: Number, default: 0 },
    mrp: { type: Number },
    discount: { type: Number },
    gst: { type: Number },
    amount: { type: Number },
    paymentId: { type: String },
    orderId: { type: String },
  },
  subscriptionHistory: [
    {
      planDuration: { type: String },
      startDate: { type: Date },
      endDate: { type: Date },
      isValid: { type: Boolean, default: false },
      votingCredits: { type: Number, default: 0 },
      usedVotingCredits: { type: Number, default: 0 },
      mrp: { type: Number },
      discount: { type: Number },
      gst: { type: Number },
      amount: { type: Number },
      paymentId: { type: String },
      orderId: { type: String },
    },
  ],
  subUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'SubUser' }], // Reference to SubUser model
});

module.exports = mongoose.model('User', userSchema);
