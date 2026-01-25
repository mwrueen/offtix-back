const mongoose = require('mongoose');

// Schema for handoff data when passing to next role
const handoffSchema = new mongoose.Schema({
  comment: {
    type: String,
    trim: true
  },
  files: [{
    filename: String,
    originalName: String,
    path: String,
    size: Number,
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  urls: [{
    title: String,
    url: String
  }],
  handoffBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  handoffAt: {
    type: Date,
    default: Date.now
  }
}, { _id: false });

// Schema for role assignment within a task
const roleAssignmentSchema = new mongoose.Schema({
  role: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TaskRole',
    required: true
  },
  order: {
    type: Number,
    required: true
  },
  assignees: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  status: {
    type: String,
    enum: ['pending', 'active', 'completed', 'skipped'],
    default: 'pending'
  },
  startedAt: {
    type: Date
  },
  completedAt: {
    type: Date
  },
  // Handoff data from this role to next
  handoff: handoffSchema
}, { _id: true });

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
  // Sequential role assignments for workflow
  roleAssignments: [roleAssignmentSchema],
  // Current active role assignment index
  currentRoleIndex: {
    type: Number,
    default: -1 // -1 means workflow not started
  },
  // Whether this task uses role-based workflow
  useRoleWorkflow: {
    type: Boolean,
    default: false
  },
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

// Get current active role assignment
taskSchema.methods.getCurrentRoleAssignment = function() {
  if (this.currentRoleIndex >= 0 && this.currentRoleIndex < this.roleAssignments.length) {
    return this.roleAssignments[this.currentRoleIndex];
  }
  return null;
};

// Get next role assignment
taskSchema.methods.getNextRoleAssignment = function() {
  const nextIndex = this.currentRoleIndex + 1;
  if (nextIndex < this.roleAssignments.length) {
    return this.roleAssignments[nextIndex];
  }
  return null;
};

// Check if workflow is complete
taskSchema.methods.isWorkflowComplete = function() {
  if (!this.useRoleWorkflow || this.roleAssignments.length === 0) {
    return true;
  }
  return this.roleAssignments.every(ra => ra.status === 'completed' || ra.status === 'skipped');
};

module.exports = mongoose.model('Task', taskSchema);