const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true,
    index: true
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  content: {
    type: String,
    required: true,
    trim: true,
    maxlength: 5000
  },
  // Users mentioned in the message using @
  mentions: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  // Message type: text, system (for join/leave notifications)
  type: {
    type: String,
    enum: ['text', 'system', 'file'],
    default: 'text'
  },
  // For file attachments
  attachment: {
    name: String,
    url: String,
    size: Number,
    type: String
  },
  // Reply to another message
  replyTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message'
  },
  // Track who has read this message
  readBy: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    readAt: {
      type: Date,
      default: Date.now
    }
  }],
  // Soft delete
  isDeleted: {
    type: Boolean,
    default: false
  },
  deletedAt: {
    type: Date
  },
  // Edit tracking
  isEdited: {
    type: Boolean,
    default: false
  },
  editedAt: {
    type: Date
  }
}, {
  timestamps: true
});

// Index for efficient querying
messageSchema.index({ project: 1, createdAt: -1 });
messageSchema.index({ sender: 1 });
messageSchema.index({ mentions: 1 });

// Virtual to check if message is recent (within 5 minutes for editing)
messageSchema.virtual('canEdit').get(function() {
  const fiveMinutes = 5 * 60 * 1000;
  return (Date.now() - this.createdAt.getTime()) < fiveMinutes;
});

// Static method to get messages for a project with pagination
messageSchema.statics.getProjectMessages = async function(projectId, options = {}) {
  const { page = 1, limit = 50, before } = options;
  
  const query = { 
    project: projectId, 
    isDeleted: false 
  };
  
  if (before) {
    query.createdAt = { $lt: new Date(before) };
  }
  
  const messages = await this.find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip((page - 1) * limit)
    .populate('sender', 'name email profile.profilePicture')
    .populate('mentions', 'name email')
    .populate('replyTo', 'content sender')
    .lean();
  
  return messages.reverse(); // Return in chronological order
};

// Instance method to mark as read by a user
messageSchema.methods.markAsRead = async function(userId) {
  const alreadyRead = this.readBy.some(r => r.user.toString() === userId.toString());
  if (!alreadyRead) {
    this.readBy.push({ user: userId, readAt: new Date() });
    return this.save();
  }
  return this;
};

module.exports = mongoose.model('Message', messageSchema);

