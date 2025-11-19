const mongoose = require('mongoose');

const companySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  industry: {
    type: String,
    trim: true
  },
  website: {
    type: String,
    trim: true
  },
  email: {
    type: String,
    trim: true,
    lowercase: true
  },
  phone: {
    type: String,
    trim: true
  },
  address: {
    type: String,
    trim: true
  },
  city: {
    type: String,
    trim: true
  },
  state: {
    type: String,
    trim: true
  },
  country: {
    type: String,
    trim: true
  },
  zipCode: {
    type: String,
    trim: true
  },
  foundedYear: {
    type: Number
  },
  companySize: {
    type: String,
    trim: true
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  designations: [{
    name: {
      type: String,
      required: true
    },
    description: String,
    permissions: {
      addEmployee: { type: Boolean, default: false },
      viewEmployeeList: { type: Boolean, default: true },
      editEmployee: { type: Boolean, default: false },
      createDesignation: { type: Boolean, default: false },
      viewDesignations: { type: Boolean, default: true },
      editDesignation: { type: Boolean, default: false },
      deleteDesignation: { type: Boolean, default: false },
      createProject: { type: Boolean, default: false },
      assignEmployeeToProject: { type: Boolean, default: false },
      removeEmployeeFromProject: { type: Boolean, default: false },
      manageCompanySettings: { type: Boolean, default: false }
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],

  members: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    designation: {
      type: String,
      required: false,
      default: 'Employee'
    },
    currentSalary: {
      type: Number,
      default: 0
    },
    salaryHistory: [{
      amount: {
        type: Number,
        required: true
      },
      effectiveDate: {
        type: Date,
        required: true
      },
      reason: String,
      updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      createdAt: {
        type: Date,
        default: Date.now
      }
    }],
    joinedAt: {
      type: Date,
      default: Date.now
    }
  }],

  // Company-wide settings
  settings: {
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
      }
    },
    workingDays: {
      type: [Number],
      default: [1, 2, 3, 4, 5], // Monday to Friday (0=Sunday, 6=Saturday)
      validate: {
        validator: function(days) {
          return days.every(day => day >= 0 && day <= 6);
        },
        message: 'Working days must be between 0 (Sunday) and 6 (Saturday)'
      }
    },
    holidays: [{
      date: {
        type: Date,
        required: true
      },
      name: {
        type: String,
        required: true
      },
      description: String
    }],
    weekends: {
      type: [Number],
      default: [0, 6], // Sunday and Saturday
      validate: {
        validator: function(days) {
          return days.every(day => day >= 0 && day <= 6);
        },
        message: 'Weekend days must be between 0 (Sunday) and 6 (Saturday)'
      }
    }
  }
}, {
  timestamps: true
});

// Add default designations when company is created and fix existing members
companySchema.pre('save', function(next) {
  if (this.isNew && this.designations.length === 0) {
    this.designations = [
      {
        name: 'Managing Director',
        description: 'Chief Executive Officer',
        permissions: {
          addEmployee: true,
          viewEmployeeList: true,
          editEmployee: true,
          createDesignation: true,
          viewDesignations: true,
          editDesignation: true,
          deleteDesignation: true,
          createProject: true,
          assignEmployeeToProject: true,
          removeEmployeeFromProject: true,
          manageCompanySettings: true
        }
      },
      {
        name: 'HR Manager',
        description: 'Human Resources Manager',
        permissions: {
          addEmployee: true,
          viewEmployeeList: true,
          editEmployee: true,
          createDesignation: false,
          viewDesignations: true,
          editDesignation: false,
          deleteDesignation: false,
          createProject: false,
          assignEmployeeToProject: false,
          removeEmployeeFromProject: false,
          manageCompanySettings: true
        }
      },
      {
        name: 'Project Manager',
        description: 'Project Management Lead',
        permissions: {
          addEmployee: false,
          viewEmployeeList: true,
          editEmployee: false,
          createDesignation: false,
          viewDesignations: true,
          editDesignation: false,
          deleteDesignation: false,
          createProject: true,
          assignEmployeeToProject: true,
          removeEmployeeFromProject: true,
          manageCompanySettings: false
        }
      },
      {
        name: 'Employee',
        description: 'General Employee',
        permissions: {
          addEmployee: false,
          viewEmployeeList: true,
          editEmployee: false,
          createDesignation: false,
          viewDesignations: true,
          editDesignation: false,
          deleteDesignation: false,
          createProject: false,
          assignEmployeeToProject: false,
          removeEmployeeFromProject: false,
          manageCompanySettings: false
        }
      }
    ];
  }
  
  // Fix existing members without designation
  this.members.forEach(member => {
    if (!member.designation) {
      member.designation = 'Employee';
    }
  });
  
  next();
});

module.exports = mongoose.model('Company', companySchema);