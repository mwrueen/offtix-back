const mongoose = require('mongoose');

const taskUserDurationSchema = new mongoose.Schema({
  task: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Task',
    required: true
  },
  taskStep: {
    type: mongoose.Schema.Types.ObjectId,
    required: false // Can be null if duration is for entire task
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  durationMinutes: {
    type: Number,
    required: true,
    min: 0
  }
}, {
  timestamps: true
});

// Index for efficient queries
taskUserDurationSchema.index({ task: 1, user: 1 });
taskUserDurationSchema.index({ taskStep: 1, user: 1 });
taskUserDurationSchema.index({ task: 1 });

// Compound unique index to prevent duplicate entries
taskUserDurationSchema.index({ task: 1, taskStep: 1, user: 1 }, { unique: true });

module.exports = mongoose.model('TaskUserDuration', taskUserDurationSchema);

