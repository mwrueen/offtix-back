const mongoose = require('mongoose');

const invitationSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true
  },
  company: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true
  },
  designation: {
    type: String,
    required: true
  },
  salary: {
    type: Number,
    default: 0
  },
  invitedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected', 'expired'],
    default: 'pending'
  },
  token: {
    type: String,
    required: true,
    unique: true
  },
  expiresAt: {
    type: Date,
    required: true
  },
  acceptedAt: {
    type: Date
  },
  rejectedAt: {
    type: Date
  }
}, {
  timestamps: true
});

// Index for faster queries
invitationSchema.index({ email: 1, company: 1, status: 1 });
// token index is automatically created by unique: true
invitationSchema.index({ expiresAt: 1 });

// Method to check if invitation is expired
invitationSchema.methods.isExpired = function() {
  return this.expiresAt < new Date();
};

module.exports = mongoose.model('Invitation', invitationSchema);

