const mongoose = require('mongoose');

const taskRoleSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  order: {
    type: Number,
    default: 0
  },
  color: {
    type: String,
    default: '#6366f1' // Default indigo color
  },
  icon: {
    type: String,
    default: '👤'
  },
  // Default assignees for this role (can be overridden at task level)
  defaultAssignees: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  // Estimated duration for tasks in this role
  estimatedDuration: {
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
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Index for efficient queries
taskRoleSchema.index({ project: 1, order: 1 });
taskRoleSchema.index({ project: 1, isActive: 1 });

// Default workflow roles template
taskRoleSchema.statics.getDefaultRoles = function() {
  return [
    { name: 'UI/UX Design', description: 'User interface and experience design', order: 1, color: '#8b5cf6', icon: '🎨' },
    { name: 'Database Design', description: 'Database schema and architecture design', order: 2, color: '#06b6d4', icon: '🗄️' },
    { name: 'Backend API', description: 'Server-side API development', order: 3, color: '#10b981', icon: '⚙️' },
    { name: 'Frontend Development', description: 'Client-side UI implementation', order: 4, color: '#f59e0b', icon: '💻' },
    { name: 'Testing & Debugging', description: 'Quality assurance and bug fixing', order: 5, color: '#ef4444', icon: '🧪' },
    { name: 'Deployment & Maintenance', description: 'Deployment, monitoring and maintenance', order: 6, color: '#6366f1', icon: '🚀' }
  ];
};

module.exports = mongoose.model('TaskRole', taskRoleSchema);

