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
      removeEmployeeFromProject: { type: Boolean, default: false }
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
  }]
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
          removeEmployeeFromProject: true
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
          removeEmployeeFromProject: false
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
          removeEmployeeFromProject: true
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
          removeEmployeeFromProject: false
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