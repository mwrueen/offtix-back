const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  status: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TaskStatus'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent']
  },
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true
  },
  sprint: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Sprint'
  },
  phase: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Phase'
  },
  parent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Task'
  },
  assignees: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  dependencies: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Task'
  }],
  duration: {
    value: {
      type: Number,
      min: 0
    },
    unit: {
      type: String,
      enum: ['minutes', 'hours', 'days', 'weeks'],
      default: 'hours'
    }
  },
  startDate: {
    type: Date
  },
  dueDate: {
    type: Date
  },
  order: {
    type: Number,
    default: 0
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Task', taskSchema);