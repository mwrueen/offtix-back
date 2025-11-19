const mongoose = require('mongoose');

const leaveSchema = new mongoose.Schema({
  company: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true
  },
  employee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  leaveType: {
    type: String,
    enum: ['sick', 'casual', 'annual', 'maternity', 'paternity', 'unpaid', 'other'],
    required: true
  },
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },
  halfDay: {
    type: Boolean,
    default: false
  },
  halfDayPeriod: {
    type: String,
    enum: ['morning', 'afternoon', null],
    default: null
  },
  totalDays: {
    type: Number
  },
  reason: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'cancelled'],
    default: 'pending'
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedAt: {
    type: Date
  },
  rejectionReason: {
    type: String
  },
  attachments: [{
    filename: String,
    url: String,
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  notes: {
    type: String
  }
}, {
  timestamps: true
});

// Index for efficient queries
leaveSchema.index({ company: 1, employee: 1, startDate: -1 });
leaveSchema.index({ company: 1, status: 1 });

// Calculate total days before saving
leaveSchema.pre('save', function(next) {
  console.log('Pre-save hook running. isNew:', this.isNew, 'startDate:', this.startDate, 'endDate:', this.endDate, 'halfDay:', this.halfDay);

  if (this.isNew || this.isModified('startDate') || this.isModified('endDate') || this.isModified('halfDay')) {
    const start = new Date(this.startDate);
    const end = new Date(this.endDate);
    const diffTime = Math.abs(end - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

    this.totalDays = this.halfDay ? 0.5 : diffDays;
    console.log('Calculated totalDays:', this.totalDays);
  }
  next();
});

module.exports = mongoose.model('Leave', leaveSchema);

