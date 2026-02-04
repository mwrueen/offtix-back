const Company = require('../models/Company');
const User = require('../models/User');

// Get all employees for a company with detailed information
exports.getCompanyEmployees = async (req, res) => {
  try {
    const { companyId } = req.params;
    
    if (!companyId) {
      return res.status(400).json({ error: 'Company ID is required' });
    }

    const company = await Company.findById(companyId)
      .populate('owner', 'name email profile')
      .populate('members.user', 'name email profile createdAt');
    
    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    // Check if user has access to this company
    const hasCompanyAccess = company.owner._id.toString() === req.user._id.toString() ||
                            company.members.some(member => member.user._id.toString() === req.user._id.toString());
    
    if (!hasCompanyAccess) {
      return res.status(403).json({ error: 'Access denied to this company' });
    }

    // Format employee data
    const employees = [];
    
    // Add owner as an employee
    employees.push({
      _id: company.owner._id,
      name: company.owner.name,
      email: company.owner.email,
      profile: company.owner.profile,
      designation: 'Owner',
      currentSalary: 0,
      salaryHistory: [],
      joinedAt: company.createdAt,
      isOwner: true,
      createdAt: company.owner.createdAt
    });

    // Add members (excluding owner to avoid duplicates)
    company.members.forEach(member => {
      if (member.user && member.user._id.toString() !== company.owner._id.toString()) {
        employees.push({
          _id: member.user._id,
          memberId: member._id,
          name: member.user.name,
          email: member.user.email,
          profile: member.user.profile,
          designation: member.designation,
          currentSalary: member.currentSalary,
          salaryHistory: member.salaryHistory,
          joinedAt: member.joinedAt,
          isOwner: false,
          createdAt: member.user.createdAt
        });
      }
    });

    res.json({
      company: {
        _id: company._id,
        name: company.name,
        description: company.description,
        currency: company.currency,
        owner: company.owner,
        members: company.members,
        designations: company.designations
      },
      employees,
      designations: company.designations
    });
  } catch (error) {
    console.error('Error getting company employees:', error);
    res.status(500).json({ error: 'Error getting company employees: ' + error.message });
  }
};

// Get single employee details
exports.getEmployeeDetails = async (req, res) => {
  try {
    const { companyId, employeeId } = req.params;
    
    const company = await Company.findById(companyId)
      .populate('owner', 'name email profile role createdAt')
      .populate('members.user', 'name email profile role createdAt');
    
    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    // Check if user has access to this company
    const hasCompanyAccess = company.owner._id.toString() === req.user._id.toString() ||
                            company.members.some(member => member.user._id.toString() === req.user._id.toString());
    
    if (!hasCompanyAccess) {
      return res.status(403).json({ error: 'Access denied to this company' });
    }

    let employee = null;

    // Check if it's the owner
    if (company.owner._id.toString() === employeeId) {
      employee = {
        _id: company.owner._id,
        name: company.owner.name,
        email: company.owner.email,
        profile: company.owner.profile,
        role: company.owner.role,
        designation: 'Owner',
        currentSalary: 0,
        salaryHistory: [],
        joinedAt: company.createdAt,
        isOwner: true,
        createdAt: company.owner.createdAt
      };
    } else {
      // Find in members
      const member = company.members.find(m => m.user._id.toString() === employeeId);
      if (member && member.user) {
        employee = {
          _id: member.user._id,
          memberId: member._id,
          name: member.user.name,
          email: member.user.email,
          profile: member.user.profile,
          role: member.user.role,
          designation: member.designation,
          currentSalary: member.currentSalary,
          salaryHistory: member.salaryHistory,
          joinedAt: member.joinedAt,
          isOwner: false,
          createdAt: member.user.createdAt
        };
      }
    }

    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    res.json({
      company: {
        _id: company._id,
        name: company.name,
        description: company.description,
        currency: company.currency
      },
      employee,
      designations: company.designations
    });
  } catch (error) {
    console.error('Error getting employee details:', error);
    res.status(500).json({ error: 'Error getting employee details: ' + error.message });
  }
};

// Update employee designation
exports.updateEmployeeDesignation = async (req, res) => {
  try {
    const { companyId, employeeId } = req.params;
    const { designation } = req.body;
    
    const company = await Company.findById(companyId);
    
    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    // Check permissions
    const user = await User.findById(req.user._id);
    const userMember = company.members.find(m => m.user.toString() === req.user._id.toString());
    const userDesignation = userMember ? company.designations.find(d => d.name === userMember.designation) : null;
    
    const canManageEmployees = user.role === 'superadmin' || 
                              company.owner.toString() === req.user._id.toString() ||
                              (userDesignation && userDesignation.permissions.editEmployee);
    
    if (!canManageEmployees) {
      return res.status(403).json({ error: 'You do not have permission to manage employees' });
    }

    // Find and update member
    const member = company.members.find(m => m.user.toString() === employeeId);
    if (!member) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    member.designation = designation;
    await company.save();
    
    const populatedCompany = await Company.findById(company._id)
      .populate('owner', 'name email profile')
      .populate('members.user', 'name email profile');

    res.json({ message: 'Employee designation updated successfully', company: populatedCompany });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Update employee salary
exports.updateEmployeeSalary = async (req, res) => {
  try {
    const { companyId, employeeId } = req.params;
    const { newSalary, reason } = req.body;
    
    const company = await Company.findById(companyId);
    
    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    // Check permissions
    const user = await User.findById(req.user._id);
    const userMember = company.members.find(m => m.user.toString() === req.user._id.toString());
    const userDesignation = userMember ? company.designations.find(d => d.name === userMember.designation) : null;
    
    const canManageSalaries = user.role === 'superadmin' || 
                             company.owner.toString() === req.user._id.toString() ||
                             (userDesignation && userDesignation.permissions.editEmployee);
    
    if (!canManageSalaries) {
      return res.status(403).json({ error: 'You do not have permission to manage salaries' });
    }

    // Find and update member
    const member = company.members.find(m => m.user.toString() === employeeId);
    if (!member) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    // Add to salary history
    member.salaryHistory.push({
      amount: newSalary,
      effectiveDate: new Date(),
      reason: reason || 'Salary update',
      updatedBy: req.user._id
    });

    member.currentSalary = newSalary;
    await company.save();
    
    const populatedCompany = await Company.findById(company._id)
      .populate('owner', 'name email profile')
      .populate('members.user', 'name email profile');

    res.json({ message: 'Employee salary updated successfully', company: populatedCompany });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Remove employee from company
exports.removeEmployee = async (req, res) => {
  try {
    const { companyId, employeeId } = req.params;
    
    const company = await Company.findById(companyId);
    
    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    // Check permissions
    const user = await User.findById(req.user._id);
    const userMember = company.members.find(m => m.user.toString() === req.user._id.toString());
    const userDesignation = userMember ? company.designations.find(d => d.name === userMember.designation) : null;
    
    const canRemoveEmployees = user.role === 'superadmin' || 
                              company.owner.toString() === req.user._id.toString() ||
                              (userDesignation && userDesignation.permissions.editEmployee);
    
    if (!canRemoveEmployees) {
      return res.status(403).json({ error: 'You do not have permission to remove employees' });
    }

    // Cannot remove owner
    if (company.owner.toString() === employeeId) {
      return res.status(400).json({ error: 'Cannot remove company owner' });
    }

    // Find and remove member
    const memberIndex = company.members.findIndex(m => m.user.toString() === employeeId);
    if (memberIndex === -1) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    company.members.splice(memberIndex, 1);
    await company.save();
    
    // Update user's company reference
    await User.findByIdAndUpdate(employeeId, { $unset: { company: 1 } });

    res.json({ message: 'Employee removed successfully' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

