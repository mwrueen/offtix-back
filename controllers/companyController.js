const Company = require('../models/Company');
const User = require('../models/User');
const Task = require('../models/Task');
const Project = require('../models/Project');
const TaskStatus = require('../models/TaskStatus');

exports.createCompany = async (req, res) => {
  try {
    const {
      name,
      description,
      industry,
      website,
      email,
      phone,
      address,
      city,
      state,
      country,
      zipCode,
      foundedYear,
      companySize,
      founderRole,
      additionalRoles
    } = req.body;

    const company = new Company({
      name,
      description,
      industry,
      website,
      email,
      phone,
      address,
      city,
      state,
      country,
      zipCode,
      foundedYear,
      companySize,
      owner: req.user._id,
      members: [{
        user: req.user._id,
        designation: founderRole || 'Founder/Owner',
        currentSalary: 0
      }]
    });

    // Add custom founder role to designations if provided
    if (founderRole && founderRole !== 'Managing Director') {
      company.designations.push({
        name: founderRole,
        description: 'Company Founder/Owner',
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
      });
    }

    // Add additional roles if provided
    if (additionalRoles && Array.isArray(additionalRoles)) {
      additionalRoles.forEach(role => {
        if (role.name && role.name.trim()) {
          company.designations.push({
            name: role.name.trim(),
            description: role.description || '',
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
          });
        }
      });
    }

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
          removeEmployeeFromProject: true,
          manageCompanySettings: true
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
              removeEmployeeFromProject: false,
              manageCompanySettings: false
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

// Company Settings Management
exports.updateCompanySettings = async (req, res) => {
  try {
    const { id } = req.params;
    const { settings } = req.body;

    const company = await Company.findById(id);
    if (!company) {
      return res.status(404).json({ message: 'Company not found' });
    }

    // Check if user is company owner
    if (company.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only company owner can update settings' });
    }

    // Update settings - deep merge to preserve nested objects
    if (!company.settings) {
      company.settings = {};
    }

    // Preserve timeTracking if not provided
    if (!settings.timeTracking && company.settings.timeTracking) {
      settings.timeTracking = company.settings.timeTracking;
    }

    // Preserve holidays if not provided
    if (!settings.holidays && company.settings.holidays) {
      settings.holidays = company.settings.holidays;
    }

    // Update settings
    company.settings = {
      ...company.settings.toObject(),
      ...settings,
      timeTracking: {
        ...(company.settings.timeTracking || {}),
        ...(settings.timeTracking || {})
      }
    };

    await company.save();

    const populatedCompany = await Company.findById(company._id)
      .populate('owner', 'name email')
      .populate('members.user', 'name email');

    res.json({ message: 'Settings updated successfully', company: populatedCompany });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.addHoliday = async (req, res) => {
  try {
    const { id } = req.params;
    const { date, name, description } = req.body;

    const company = await Company.findById(id);
    if (!company) {
      return res.status(404).json({ message: 'Company not found' });
    }

    // Check if user is company owner
    if (company.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only company owner can add holidays' });
    }

    if (!company.settings) {
      company.settings = { holidays: [] };
    }
    if (!company.settings.holidays) {
      company.settings.holidays = [];
    }

    company.settings.holidays.push({ date, name, description });
    await company.save();

    const populatedCompany = await Company.findById(company._id)
      .populate('owner', 'name email')
      .populate('members.user', 'name email');

    res.json({ message: 'Holiday added successfully', company: populatedCompany });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.removeHoliday = async (req, res) => {
  try {
    const { id, holidayId } = req.params;

    const company = await Company.findById(id);
    if (!company) {
      return res.status(404).json({ message: 'Company not found' });
    }

    // Check if user is company owner
    if (company.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only company owner can remove holidays' });
    }

    if (company.settings && company.settings.holidays) {
      company.settings.holidays = company.settings.holidays.filter(
        h => h._id.toString() !== holidayId
      );
      await company.save();
    }

    const populatedCompany = await Company.findById(company._id)
      .populate('owner', 'name email')
      .populate('members.user', 'name email');

    res.json({ message: 'Holiday removed successfully', company: populatedCompany });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get workforce - employees with their current tasks
exports.getWorkforce = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id.toString();

    const company = await Company.findById(id)
      .populate('owner', 'name email avatar')
      .populate('members.user', 'name email avatar');

    if (!company) {
      return res.status(404).json({ message: 'Company not found' });
    }

    // Check permission - only owner, superadmin, or those with viewEmployeeList permission
    const isOwner = company.owner._id.toString() === userId;
    const isSuperAdmin = req.user.role === 'superadmin';

    let hasPermission = isOwner || isSuperAdmin;

    if (!hasPermission) {
      const memberInfo = company.members.find(m => {
        const memberId = m.user?._id?.toString() || m.user?.toString();
        return memberId === userId;
      });

      if (memberInfo) {
        const designation = company.designations.find(d => d.name === memberInfo.designation);
        if (designation?.permissions?.viewEmployeeList) {
          hasPermission = true;
        }
      }
    }

    if (!hasPermission) {
      return res.status(403).json({ message: 'Not authorized to view workforce' });
    }

    // Get all projects for this company with settings
    const companyProjects = await Project.find({ company: id }).select('_id title settings');
    const projectIds = companyProjects.map(p => p._id);

    // Get company settings for cost calculation
    const hoursPerDay = company.settings?.timeTracking?.hoursPerDay || 8;
    const daysPerWeek = company.settings?.timeTracking?.daysPerWeek || 5;
    const workingDaysPerMonth = daysPerWeek * 4.33; // Average weeks per month
    const workingHoursPerMonth = workingDaysPerMonth * hoursPerDay;

    // Helper function to calculate hourly rate from monthly salary
    const calculateHourlyRate = (monthlySalary) => {
      if (!monthlySalary || monthlySalary <= 0) return 0;
      return monthlySalary / workingHoursPerMonth;
    };

    // Helper function to convert task duration to hours
    const durationToHours = (duration, projectSettings) => {
      if (!duration || !duration.value) return 0;
      const projHoursPerDay = projectSettings?.timeTracking?.hoursPerDay || hoursPerDay;
      const projDaysPerWeek = projectSettings?.timeTracking?.daysPerWeek || daysPerWeek;

      switch (duration.unit) {
        case 'minutes': return duration.value / 60;
        case 'hours': return duration.value;
        case 'days': return duration.value * projHoursPerDay;
        case 'weeks': return duration.value * projDaysPerWeek * projHoursPerDay;
        default: return duration.value;
      }
    };

    // Get all members (including owner) with their salaries
    const allMembers = [];

    // Find owner's member record for salary
    const ownerMemberRecord = company.members.find(m =>
      m.user._id.toString() === company.owner._id.toString()
    );

    // Add owner
    if (company.owner) {
      allMembers.push({
        user: company.owner,
        designation: ownerMemberRecord?.designation || 'Owner',
        isOwner: true,
        joinedAt: company.createdAt,
        currentSalary: ownerMemberRecord?.currentSalary || 0
      });
    }

    // Add members (excluding owner if they're also in members list)
    company.members.forEach(member => {
      if (member.user && member.user._id.toString() !== company.owner._id.toString()) {
        allMembers.push({
          user: member.user,
          designation: member.designation || 'Employee',
          isOwner: false,
          joinedAt: member.joinedAt,
          currentSalary: member.currentSalary || 0
        });
      }
    });

    // For each member, get their current tasks with cost calculation
    const workforceData = await Promise.all(allMembers.map(async (member) => {
      const memberId = member.user._id;
      const hourlyRate = calculateHourlyRate(member.currentSalary);

      // Get all tasks assigned to this user in company projects
      const tasks = await Task.find({
        project: { $in: projectIds },
        assignees: memberId
      })
        .populate('project', 'title settings')
        .populate('status', 'name color')
        .sort({ dueDate: 1 });

      // Categorize tasks and calculate costs
      const now = new Date();
      const activeTasks = [];
      const overdueTasks = [];
      const completedTasks = [];
      let totalTaskCost = 0;
      let activeTaskCost = 0;
      let completedTaskCost = 0;

      tasks.forEach(task => {
        // Calculate task cost for this employee
        const taskHours = durationToHours(task.duration, task.project?.settings);
        // Cost per assignee (divide by number of assignees if task is shared)
        const assigneeCount = task.assignees?.length || 1;
        const taskCost = (taskHours * hourlyRate) / assigneeCount;

        const taskData = {
          _id: task._id,
          title: task.title,
          project: { _id: task.project?._id, title: task.project?.title },
          status: task.status,
          priority: task.priority,
          startDate: task.startDate,
          dueDate: task.dueDate,
          duration: task.duration,
          durationHours: taskHours,
          cost: Math.round(taskCost * 100) / 100,
          isOverdue: task.dueDate && new Date(task.dueDate) < now &&
                     task.status?.name?.toLowerCase() !== 'done' &&
                     task.status?.name?.toLowerCase() !== 'completed'
        };

        totalTaskCost += taskCost;

        // Check if task is completed
        const statusName = task.status?.name?.toLowerCase() || '';
        if (statusName === 'done' || statusName === 'completed') {
          completedTasks.push(taskData);
          completedTaskCost += taskCost;
        } else if (taskData.isOverdue) {
          overdueTasks.push(taskData);
          activeTaskCost += taskCost;
        } else {
          activeTasks.push(taskData);
          activeTaskCost += taskCost;
        }
      });

      return {
        employee: {
          _id: member.user._id,
          name: member.user.name,
          email: member.user.email,
          avatar: member.user.avatar,
          designation: member.designation,
          isOwner: member.isOwner,
          joinedAt: member.joinedAt,
          monthlySalary: member.currentSalary,
          hourlyRate: Math.round(hourlyRate * 100) / 100
        },
        tasks: {
          active: activeTasks,
          overdue: overdueTasks,
          completed: completedTasks,
          totalActive: activeTasks.length,
          totalOverdue: overdueTasks.length,
          totalCompleted: completedTasks.length,
          total: tasks.length
        },
        costs: {
          totalTaskCost: Math.round(totalTaskCost * 100) / 100,
          activeTaskCost: Math.round(activeTaskCost * 100) / 100,
          completedTaskCost: Math.round(completedTaskCost * 100) / 100
        }
      };
    }));

    // Calculate total costs
    const totalCosts = {
      totalTaskCost: workforceData.reduce((sum, w) => sum + w.costs.totalTaskCost, 0),
      activeTaskCost: workforceData.reduce((sum, w) => sum + w.costs.activeTaskCost, 0),
      completedTaskCost: workforceData.reduce((sum, w) => sum + w.costs.completedTaskCost, 0)
    };

    res.json({
      company: {
        _id: company._id,
        name: company.name,
        settings: {
          hoursPerDay,
          daysPerWeek,
          workingHoursPerMonth: Math.round(workingHoursPerMonth * 100) / 100
        }
      },
      workforce: workforceData,
      summary: {
        totalEmployees: workforceData.length,
        totalActiveTasks: workforceData.reduce((sum, w) => sum + w.tasks.totalActive, 0),
        totalOverdueTasks: workforceData.reduce((sum, w) => sum + w.tasks.totalOverdue, 0),
        totalCompletedTasks: workforceData.reduce((sum, w) => sum + w.tasks.totalCompleted, 0)
      },
      costs: {
        total: Math.round(totalCosts.totalTaskCost * 100) / 100,
        active: Math.round(totalCosts.activeTaskCost * 100) / 100,
        completed: Math.round(totalCosts.completedTaskCost * 100) / 100
      }
    });
  } catch (error) {
    console.error('Error getting workforce:', error);
    res.status(500).json({ message: error.message });
  }
};