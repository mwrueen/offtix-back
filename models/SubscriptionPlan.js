const mongoose = require('mongoose');

const subscriptionPlanSchema = new mongoose.Schema({
  name: {
    type: String,
    default: 'Premium Plan'
  },
  monthlyPrice: {
    type: Number,
    default: 10
  },
  currency: {
    type: String,
    default: 'usd'
  },
  description: {
    type: String,
    default: 'Full access to AI assistant system-wide, project file uploads, chat document sending, and task completion file attachments.'
  },
  premiumFeatures: {
    allowAI: { type: Boolean, default: true },
    allowProjectFiles: { type: Boolean, default: true },
    allowChatDocs: { type: Boolean, default: true },
    allowTaskCompletionDocs: { type: Boolean, default: true }
  },
  freeRestrictions: {
    allowAI: { type: Boolean, default: false },
    allowProjectFiles: { type: Boolean, default: false },
    allowChatDocs: { type: Boolean, default: false },
    allowTaskCompletionDocs: { type: Boolean, default: false }
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('SubscriptionPlan', subscriptionPlanSchema);
