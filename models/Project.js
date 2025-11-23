const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['planning', 'active', 'completed', 'on-hold'],
    default: 'planning'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  startDate: {
    type: Date,
    default: Date.now
  },
  endDate: {
    type: Date
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  members: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    role: {
      type: String,
      required: true,
      trim: true
    },
    addedAt: {
      type: Date,
      default: Date.now
    }
  }],
  company: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company'
  },
  // Budget and Cost Tracking
  budget: {
    amount: { type: Number, default: 0 },
    currency: { type: String, default: 'USD' }
  },
  actualCost: {
    amount: { type: Number, default: 0 },
    currency: { type: String, default: 'USD' }
  },
  // Tags for categorization
  tags: [{
    type: String,
    trim: true
  }],
  // File Attachments
  attachments: [{
    name: { type: String, required: true },
    url: { type: String, required: true },
    size: { type: Number }, // in bytes
    type: { type: String }, // file mime type
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  // Milestones
  milestones: [{
    title: { type: String, required: true },
    description: { type: String },
    dueDate: { type: Date },
    status: {
      type: String,
      enum: ['pending', 'in-progress', 'completed', 'delayed'],
      default: 'pending'
    },
    completedAt: { type: Date },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  // Risks
  risks: [{
    title: { type: String, required: true },
    description: { type: String },
    severity: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'medium'
    },
    probability: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium'
    },
    mitigation: { type: String },
    status: {
      type: String,
      enum: ['identified', 'monitoring', 'mitigated', 'occurred'],
      default: 'identified'
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  // Dependencies
  dependencies: [{
    title: { type: String, required: true },
    description: { type: String },
    type: {
      type: String,
      enum: ['internal', 'external', 'technical', 'resource', 'business'],
      default: 'internal'
    },
    status: {
      type: String,
      enum: ['pending', 'in-progress', 'resolved', 'blocked'],
      default: 'pending'
    },
    dueDate: { type: Date },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  // Progress Tracking
  progress: {
    percentage: { type: Number, default: 0, min: 0, max: 100 },
    tasksCompleted: { type: Number, default: 0 },
    tasksTotal: { type: Number, default: 0 },
    lastUpdated: { type: Date, default: Date.now }
  },
  // Custom Fields for flexibility
  customFields: [{
    key: { type: String, required: true },
    value: { type: String },
    type: {
      type: String,
      enum: ['text', 'number', 'date', 'boolean', 'url'],
      default: 'text'
    }
  }],
  // Activity Log
  activityLog: [{
    action: { type: String, required: true },
    description: { type: String },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    metadata: { type: mongoose.Schema.Types.Mixed }
  }],
  // Project Settings
  settings: {
    // Time Tracking Settings
    timeTracking: {
      defaultDurationUnit: {
        type: String,
        enum: ['minutes', 'hours', 'days', 'weeks'],
        default: 'hours'
      },
      hoursPerDay: {
        type: Number,
        default: 8,
        min: 1,
        max: 24
      },
      daysPerWeek: {
        type: Number,
        default: 5,
        min: 1,
        max: 7
      },
      workingHoursStart: {
        type: String,
        default: '09:00',
        validate: {
          validator: function(time) {
            return /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(time);
          },
          message: 'Working hours start must be in HH:MM format'
        }
      },
      workingHoursEnd: {
        type: String,
        default: '17:00',
        validate: {
          validator: function(time) {
            return /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(time);
          },
          message: 'Working hours end must be in HH:MM format'
        }
      }
    },
    // Working Days (0 = Sunday, 6 = Saturday)
    workingDays: {
      type: [Number],
      default: [1, 2, 3, 4, 5] // Monday to Friday
    },
    // Holidays (array of dates)
    holidays: [{
      date: { type: Date, required: true },
      name: { type: String, required: true },
      description: { type: String }
    }],
    // Default Task Settings
    defaultTaskStatus: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TaskStatus'
    }
  }
}, {
  timestamps: true
});

// Method to add activity log entry
projectSchema.methods.addActivity = function(action, description, userId, metadata = {}) {
  this.activityLog.push({
    action,
    description,
    user: userId,
    metadata
  });
  return this.save();
};

// Method to update progress
projectSchema.methods.updateProgress = function(tasksCompleted, tasksTotal) {
  const percentage = tasksTotal > 0 ? Math.round((tasksCompleted / tasksTotal) * 100) : 0;
  this.progress = {
    percentage,
    tasksCompleted,
    tasksTotal,
    lastUpdated: new Date()
  };
  return this.save();
};

module.exports = mongoose.model('Project', projectSchema);