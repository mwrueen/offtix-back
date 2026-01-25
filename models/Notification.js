const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: [
      'invitation',
      'project_assignment',
      'salary_update',
      'role_change',
      'general',
      'task_role_assignment',  // Notified when assigned to a role in a task
      'task_role_handoff',     // Notified when previous role hands off to you
      'task_role_completed'    // Notified when your role is marked complete
    ],
    required: true
  },
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  relatedId: {
    type: mongoose.Schema.Types.ObjectId
  },
  relatedModel: {
    type: String,
    enum: ['Invitation', 'Project', 'Company', 'Task', 'TaskRole']
  },
  // Additional metadata for role notifications
  metadata: {
    taskId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Task'
    },
    roleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TaskRole'
    },
    roleName: String,
    handoffComment: String,
    handoffFiles: [{
      filename: String,
      originalName: String,
      path: String
    }],
    handoffUrls: [{
      title: String,
      url: String
    }],
    fromUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  isRead: {
    type: Boolean,
    default: false
  },
  readAt: {
    type: Date
  }
}, {
  timestamps: true
});

// Index for faster queries
notificationSchema.index({ user: 1, isRead: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);

