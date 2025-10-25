const Company = require('../models/Company');
const User = require('../models/User');

exports.createCompany = async (req, res) => {
  try {
    const { name, description } = req.body;
    
    const company = new Company({
      name,
      description,
      owner: req.user._id,
      members: [{
        user: req.user._id,
        designation: 'Managing Director',
        currentSalary: 0
      }]
    });

    await company.save();
    await User.findByIdAndUpdate(req.user._id, { company: company._id });

    const populatedCompany = await Company.findById(company._id)
      .populate('owner', 'name email')
      .populate('members.user', 'name email');

    res.status(201).json(populatedCompany);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.getCompany = async (req, res) => {
  try {
    const company = await Company.findById(req.params.id)
      .populate('owner', 'name email')
      .populate('members.user', 'name email');
    
    if (!company) {
      return res.status(404).json({ message: 'Company not found' });
    }

    res.json(company);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.addMember = async (req, res) => {
  try {
    const { email, designation, salary } = req.body;
    
    const userToAdd = await User.findOne({ email });
    if (!userToAdd) {
      return res.status(404).json({ message: 'User not found with this email' });
    }
    
    const userId = userToAdd._id;
    const company = await Company.findById(req.params.id);

    if (!company) {
      return res.status(404).json({ message: 'Company not found' });
    }

    const user = await User.findById(req.user._id);
    const userMember = company.members.find(m => m.user.toString() === req.user._id.toString());
    const userDesignation = userMember ? company.designations.find(d => d.name === userMember.designation) : null;
    
    const canAddMembers = user.role === 'superadmin' || 
                         company.owner.toString() === req.user._id.toString() ||
                         (userDesignation && userDesignation.permissions.addEmployee);
    
    if (!canAddMembers) {
      return res.status(403).json({ message: 'You do not have permission to add employees' });
    }

    const newMember = {
      user: userId,
      designation,
      currentSalary: salary || 0
    };

    if (salary > 0) {
      newMember.salaryHistory = [{
        amount: salary,
        effectiveDate: new Date(),
        reason: 'Initial salary',
        updatedBy: req.user._id
      }];
    }

    company.members.push(newMember);
    await company.save();
    await User.findByIdAndUpdate(userId, { company: company._id });

    const populatedCompany = await Company.findById(company._id)
      .populate('owner', 'name email')
      .populate('members.user', 'name email');

    res.json(populatedCompany);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.updateMemberSalary = async (req, res) => {
  try {
    const { memberId, newSalary, reason } = req.body;
    const company = await Company.findById(req.params.id);

    if (!company) {
      return res.status(404).json({ message: 'Company not found' });
    }

    const user = await User.findById(req.user._id);
    const userMember = company.members.find(m => m.user.toString() === req.user._id.toString());
    const userDesignation = userMember ? company.designations.find(d => d.name === userMember.designation) : null;
    
    const canManageSalaries = user.role === 'superadmin' || 
                             company.owner.toString() === req.user._id.toString() ||
                             (userDesignation && userDesignation.permissions.editEmployee);
    
    if (!canManageSalaries) {
      return res.status(403).json({ message: 'You do not have permission to manage salaries' });
    }

    const member = company.members.id(memberId);
    if (!member) {
      return res.status(404).json({ message: 'Member not found' });
    }

    member.salaryHistory.push({
      amount: newSalary,
      effectiveDate: new Date(),
      reason: reason || 'Salary update',
      updatedBy: req.user._id
    });

    member.currentSalary = newSalary;
    await company.save();
    
    const populatedCompany = await Company.findById(company._id)
      .populate('owner', 'name email')
      .populate('members.user', 'name email');

    res.json(populatedCompany);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.updateMemberDesignation = async (req, res) => {
  try {
    const { memberId, designation } = req.body;
    const company = await Company.findById(req.params.id);

    if (!company) {
      return res.status(404).json({ message: 'Company not found' });
    }

    const user = await User.findById(req.user._id);
    const userMember = company.members.find(m => m.user.toString() === req.user._id.toString());
    const userDesignation = userMember ? company.designations.find(d => d.name === userMember.designation) : null;
    
    const canManageEmployees = user.role === 'superadmin' || 
                              company.owner.toString() === req.user._id.toString() ||
                              (userDesignation && userDesignation.permissions.editEmployee);
    
    if (!canManageEmployees) {
      return res.status(403).json({ message: 'You do not have permission to manage employees' });
    }

    const member = company.members.id(memberId);
    if (!member) {
      return res.status(404).json({ message: 'Member not found' });
    }

    member.designation = designation;
    await company.save();
    
    const populatedCompany = await Company.findById(company._id)
      .populate('owner', 'name email')
      .populate('members.user', 'name email');

    res.json(populatedCompany);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.addDesignation = async (req, res) => {
  try {
    const { name, description, permissions } = req.body;
    const company = await Company.findById(req.params.id);

    if (!company) {
      return res.status(404).json({ message: 'Company not found' });
    }

    const user = await User.findById(req.user._id);
    const userMember = company.members.find(m => m.user.toString() === req.user._id.toString());
    const userDesignation = userMember ? company.designations.find(d => d.name === userMember.designation) : null;
    
    const canCreateDesignation = user.role === 'superadmin' || 
                                company.owner.toString() === req.user._id.toString() ||
                                (userDesignation && userDesignation.permissions.createDesignation);
    
    if (!canCreateDesignation) {
      return res.status(403).json({ message: 'You do not have permission to create designations' });
    }

    company.designations.push({ name, description, permissions });
    await company.save();
    
    const populatedCompany = await Company.findById(company._id)
      .populate('owner', 'name email')
      .populate('members.user', 'name email');
    
    res.json(populatedCompany);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.updateDesignationPermissions = async (req, res) => {
  try {
    const { designationId, permissions } = req.body;
    const company = await Company.findById(req.params.id);

    if (!company) {
      return res.status(404).json({ message: 'Company not found' });
    }

    const user = await User.findById(req.user._id);
    const userMember = company.members.find(m => m.user.toString() === req.user._id.toString());
    const userDesignation = userMember ? company.designations.find(d => d.name === userMember.designation) : null;
    
    const canEditDesignation = user.role === 'superadmin' || 
                              company.owner.toString() === req.user._id.toString() ||
                              (userDesignation && userDesignation.permissions.editDesignation);
    
    if (!canEditDesignation) {
      return res.status(403).json({ message: 'You do not have permission to edit designations' });
    }

    const designation = company.designations.id(designationId);
    if (!designation) {
      return res.status(404).json({ message: 'Designation not found' });
    }

    designation.permissions = permissions;
    await company.save();
    
    const populatedCompany = await Company.findById(company._id)
      .populate('owner', 'name email')
      .populate('members.user', 'name email');

    res.json(populatedCompany);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.getUserCompany = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate('company');
    
    let company = null;
    
    if (user.company) {
      company = await Company.findById(user.company._id)
        .populate('owner', 'name email')
        .populate('members.user', 'name email');
    } else {
      company = await Company.findOne({ owner: req.user._id })
        .populate('owner', 'name email')
        .populate('members.user', 'name email');
      
      if (company) {
        await User.findByIdAndUpdate(req.user._id, { company: company._id });
      }
    }

    res.json(company);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getUserCompanies = async (req, res) => {
  try {
    const userId = req.user._id;
    
    // Find companies where user is owner or member
    const companies = await Company.find({
      $or: [
        { owner: userId },
        { 'members.user': userId }
      ]
    })
    .populate('owner', 'name email')
    .select('_id name description owner members designations')
    .lean();

    // Add user role and permissions in each company
    const companiesWithRole = companies.map(company => {
      let userRole = 'member';
      let userDesignation = null;
      let userPermissions = {};
      
      if (company.owner._id.toString() === userId.toString()) {
        userRole = 'owner';
        userDesignation = 'Owner';
        // Owner has all permissions
        userPermissions = {
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
        };
      } else {
        // Ensure members array exists
        const members = company.members || [];
        const memberInfo = members.find(m => m.user.toString() === userId.toString());
        if (memberInfo) {
          userDesignation = memberInfo.designation;
          // Find designation permissions - ensure designations array exists
          const designations = company.designations || [];
          const designation = designations.find(d => d.name === memberInfo.designation);
          if (designation && designation.permissions) {
            userPermissions = designation.permissions;
          } else {
            // Default employee permissions if designation not found
            userPermissions = {
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
            };
          }
        }
      }
      
      return {
        id: company._id,
        name: company.name,
        description: company.description,
        userRole,
        userDesignation,
        userPermissions,
        isOwner: userRole === 'owner',
        canCreateProjects: userPermissions.createProject || userRole === 'owner',
        memberCount: (company.members || []).length
      };
    });

    res.json(companiesWithRole);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};