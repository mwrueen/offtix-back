const mongoose = require('mongoose');

const taskActivitySchema = new mongoose.Schema({
  task: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Task',
    required: true
  },
  taskStep: {
    type: mongoose.Schema.Types.ObjectId,
    required: false // Can be null if activity is for entire task
  },
  action: {
    type: String,
    enum: ['started', 'completed', 'duration_updated', 'send_back', 'status_changed', 'paused'],
    required: true
  },
  performedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  note: {
    type: String,
    trim: true
  },
  // For completion and send-back actions
  documents: [{
    filename: String,
    originalName: String,
    path: String,
    size: Number,
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  // For send-back: who it was sent back to
  sentBackTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  // For send-back: professional message
  message: {
    type: String,
    trim: true
  },
  // Metadata for different action types
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true
});

// Index for efficient queries
taskActivitySchema.index({ task: 1, createdAt: -1 });
taskActivitySchema.index({ taskStep: 1, createdAt: -1 });
taskActivitySchema.index({ performedBy: 1 });
taskActivitySchema.index({ action: 1 });

module.exports = mongoose.model('TaskActivity', taskActivitySchema);

