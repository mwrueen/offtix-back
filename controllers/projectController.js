const Project = require('../models/Project');
const Company = require('../models/Company');
const User = require('../models/User');
const { validationResult } = require('express-validator');

exports.getProjects = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate('company');
    const companyId = req.headers['x-company-id'] || req.query.companyId;
    
    let query = {};

    if (companyId && companyId !== 'personal') {
      // Filter by specific company
      // Verify user has access to this company
      const company = await Company.findById(companyId);
      if (!company) {
        return res.status(404).json({ error: 'Company not found' });
      }

      const hasCompanyAccess = company.owner.toString() === req.user._id.toString() ||
                              company.members.some(member => member.user.toString() === req.user._id.toString());
      
      if (!hasCompanyAccess) {
        return res.status(403).json({ error: 'Access denied to this company' });
      }

      // Show only projects belonging to this company
      query = { company: companyId };
    } else {
      // Personal mode - show projects without company assignment or owned by user
      query = {
        $and: [
          {
            $or: [
              { owner: req.user._id },
              { 'members.user': req.user._id }
            ]
          },
          {
            $or: [
              { company: null },
              { company: { $exists: false } }
            ]
          }
        ]
      };
    }

    const projects = await Project.find(query)
      .populate('owner', 'name email')
      .populate('members.user', 'name email')
      .populate('company', 'name')
      .sort({ createdAt: -1 });
    
    res.json(projects);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.createProject = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const user = await User.findById(req.user._id).populate('company');
    const companyId = req.headers['x-company-id'] || req.query.companyId;
    
    let assignedCompany = null;

    // Determine which company to assign the project to
    if (companyId && companyId !== 'personal') {
      // Verify user has access to create projects in this company
      const company = await Company.findById(companyId);
      if (!company) {
        return res.status(404).json({ error: 'Company not found' });
      }

      const isOwner = company.owner.toString() === req.user._id.toString();
      const userMember = company.members.find(m => m.user.toString() === req.user._id.toString());
      const isSuperAdmin = user.role === 'superadmin';
      
      // Check permissions to create projects in this company
      if (!isSuperAdmin && !isOwner && (!userMember || !userMember.canCreateProjects)) {
        return res.status(403).json({ error: 'You do not have permission to create projects in this company' });
      }

      assignedCompany = companyId;
    } else {
      // Personal mode - no company assignment
      assignedCompany = null;
    }

    const project = new Project({
      ...req.body,
      owner: req.user._id,
      company: assignedCompany
    });
    
    await project.save();
    await project.populate('owner', 'name email');
    if (assignedCompany) {
      await project.populate('company', 'name');
    }
    
    res.status(201).json(project);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.getProjectById = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id)
      .populate('owner', 'name email')
      .populate('members.user', 'name email')
      .populate('company', 'name');
    
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const user = await User.findById(req.user._id);
    const isSuperAdmin = user.role === 'superadmin';
    
    // Check if user has access to this project
    let hasAccess = false;
    
    // Superadmin always has access
    if (isSuperAdmin) {
      hasAccess = true;
    }
    // Check if user is the project owner
    else if (project.owner._id.equals(req.user._id)) {
      hasAccess = true;
    }
    // Check if user is a project member
    else if (project.members.some(member => member.user._id.equals(req.user._id))) {
      hasAccess = true;
    }
    // Check if project belongs to a company and user has access to that company
    else if (project.company) {
      const company = await Company.findById(project.company._id);
      if (company) {
        // Check if user is company owner or member
        hasAccess = company.owner.toString() === req.user._id.toString() ||
                   company.members.some(member => member.user.toString() === req.user._id.toString());
      }
    }
    
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(project);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateProject = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id).populate('company', 'name');
    
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const user = await User.findById(req.user._id);
    const companyId = req.headers['x-company-id'] || req.query.companyId;
    const isSuperAdmin = user.role === 'superadmin';
    
    // Check access - project owner always has access
    let hasAccess = false;
    
    // 1. Superadmin always has access
    if (isSuperAdmin) {
      hasAccess = true;
    }
    // 2. Project owner always has access (most important check)
    else if (project.owner.equals(req.user._id)) {
      hasAccess = true;
    }
    // 3. Check if user is a project member
    else if (project.members.some(member => member.user && member.user.equals(req.user._id))) {
      hasAccess = true;
    }
    // 4. Company-based access (only if not already granted access)
    else if (project.company) {
      const company = await Company.findById(project.company._id);
      if (company) {
        const isCompanyOwner = company.owner.toString() === req.user._id.toString();
        const userMember = company.members.find(m => m.user.toString() === req.user._id.toString());
        
        hasAccess = isCompanyOwner || (userMember && userMember.canEditProjects);
      }
    }
    
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    Object.assign(project, req.body);
    await project.save();
    await project.populate('owner', 'name email');
    await project.populate('members.user', 'name email');
    
    res.json(project);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Add team member to project
exports.addTeamMember = async (req, res) => {
  try {
    const { userId, role } = req.body;
    
    if (!userId || !role) {
      return res.status(400).json({ error: 'User ID and role are required' });
    }

    const project = await Project.findById(req.params.id);
    
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const user = await User.findById(req.user._id);
    const isSuperAdmin = user.role === 'superadmin';
    
    // Check if user can add team members (project owner, superadmin, or company permissions)
    let hasAccess = isSuperAdmin || project.owner.equals(req.user._id);
    
    if (!hasAccess && project.company) {
      const company = await Company.findById(project.company);
      if (company) {
        const isCompanyOwner = company.owner.toString() === req.user._id.toString();
        const userMember = company.members.find(m => m.user.toString() === req.user._id.toString());
        hasAccess = isCompanyOwner || (userMember && userMember.canEditProjects);
      }
    }
    
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Check if user is already a member
    const isAlreadyMember = project.members.some(member => 
      member.user.toString() === userId
    );
    
    if (isAlreadyMember) {
      return res.status(400).json({ error: 'User is already a team member' });
    }

    // Add the new member
    project.members.push({ user: userId, role: role.trim() });
    await project.save();
    
    // Populate and return updated project
    await project.populate('owner', 'name email');
    await project.populate('members.user', 'name email');
    
    res.json(project);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Remove team member from project
exports.removeTeamMember = async (req, res) => {
  try {
    const { userId } = req.params;
    
    const project = await Project.findById(req.params.id);
    
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const user = await User.findById(req.user._id);
    const isSuperAdmin = user.role === 'superadmin';
    
    // Check if user can remove team members
    let hasAccess = isSuperAdmin || project.owner.equals(req.user._id);
    
    if (!hasAccess && project.company) {
      const company = await Company.findById(project.company);
      if (company) {
        const isCompanyOwner = company.owner.toString() === req.user._id.toString();
        const userMember = company.members.find(m => m.user.toString() === req.user._id.toString());
        hasAccess = isCompanyOwner || (userMember && userMember.canEditProjects);
      }
    }
    
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Remove the member
    project.members = project.members.filter(member => 
      member.user.toString() !== userId
    );
    
    await project.save();
    
    // Populate and return updated project
    await project.populate('owner', 'name email');
    await project.populate('members.user', 'name email');
    
    res.json(project);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.deleteProject = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id).populate('company', 'name');
    
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const user = await User.findById(req.user._id);
    const companyId = req.headers['x-company-id'] || req.query.companyId;
    const isSuperAdmin = user.role === 'superadmin';
    
    // Check access based on company context
    let hasAccess = false;
    
    if (companyId && companyId !== 'personal') {
      // Company mode - verify project belongs to selected company and user has permissions
      if (project.company && project.company._id.toString() === companyId) {
        const company = await Company.findById(companyId);
        const isOwner = company.owner.toString() === req.user._id.toString();
        const userMember = company.members.find(m => m.user.toString() === req.user._id.toString());
        
        hasAccess = isSuperAdmin || isOwner || 
                   (userMember && (userMember.canDeleteProjects || project.owner.equals(req.user._id)));
      }
    } else {
      // Personal mode - check if project is personal and user owns it
      if (!project.company) {
        hasAccess = project.owner.equals(req.user._id) || isSuperAdmin;
      }
    }
    
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await Project.findByIdAndDelete(req.params.id);
    res.json({ message: 'Project deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get project analytics and metrics
exports.getProjectAnalytics = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id)
      .populate('owner', 'name email')
      .populate('members.user', 'name email')
      .populate('milestones')
      .populate('risks')
      .populate('dependencies');

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Calculate timeline metrics
    const now = new Date();
    const startDate = new Date(project.startDate);
    const endDate = project.endDate ? new Date(project.endDate) : null;

    let timelineProgress = 0;
    let daysElapsed = 0;
    let daysRemaining = 0;
    let totalDays = 0;

    if (endDate) {
      totalDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
      daysElapsed = Math.ceil((now - startDate) / (1000 * 60 * 60 * 24));
      daysRemaining = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));
      timelineProgress = totalDays > 0 ? Math.min(100, Math.round((daysElapsed / totalDays) * 100)) : 0;
    }

    // Calculate budget metrics
    const budgetAmount = project.budget?.amount || 0;
    const actualCostAmount = project.actualCost?.amount || 0;
    const budgetUtilization = budgetAmount > 0 ? Math.round((actualCostAmount / budgetAmount) * 100) : 0;
    const budgetRemaining = budgetAmount - actualCostAmount;

    // Calculate milestone metrics
    const totalMilestones = project.milestones?.length || 0;
    const completedMilestones = project.milestones?.filter(m => m.status === 'completed').length || 0;
    const delayedMilestones = project.milestones?.filter(m => m.status === 'delayed').length || 0;
    const milestoneProgress = totalMilestones > 0 ? Math.round((completedMilestones / totalMilestones) * 100) : 0;

    // Calculate risk metrics
    const totalRisks = project.risks?.length || 0;
    const criticalRisks = project.risks?.filter(r => r.severity === 'critical').length || 0;
    const highRisks = project.risks?.filter(r => r.severity === 'high').length || 0;
    const mitigatedRisks = project.risks?.filter(r => r.status === 'mitigated').length || 0;

    // Calculate dependency metrics
    const totalDependencies = project.dependencies?.length || 0;
    const blockedDependencies = project.dependencies?.filter(d => d.status === 'blocked').length || 0;
    const resolvedDependencies = project.dependencies?.filter(d => d.status === 'resolved').length || 0;

    // Team metrics
    const teamSize = (project.members?.length || 0) + 1; // +1 for owner

    const analytics = {
      overview: {
        status: project.status,
        priority: project.priority,
        progress: project.progress?.percentage || 0,
        teamSize
      },
      timeline: {
        startDate: project.startDate,
        endDate: project.endDate,
        daysElapsed,
        daysRemaining,
        totalDays,
        progress: timelineProgress,
        isOverdue: endDate && now > endDate
      },
      budget: {
        budgetAmount,
        actualCost: actualCostAmount,
        remaining: budgetRemaining,
        utilization: budgetUtilization,
        currency: project.budget?.currency || 'USD',
        isOverBudget: actualCostAmount > budgetAmount
      },
      milestones: {
        total: totalMilestones,
        completed: completedMilestones,
        delayed: delayedMilestones,
        progress: milestoneProgress
      },
      risks: {
        total: totalRisks,
        critical: criticalRisks,
        high: highRisks,
        mitigated: mitigatedRisks
      },
      dependencies: {
        total: totalDependencies,
        blocked: blockedDependencies,
        resolved: resolvedDependencies
      },
      health: {
        score: calculateHealthScore(project, timelineProgress, budgetUtilization, criticalRisks, blockedDependencies),
        status: getHealthStatus(project, timelineProgress, budgetUtilization, criticalRisks)
      }
    };

    res.json(analytics);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Helper function to calculate project health score
function calculateHealthScore(project, timelineProgress, budgetUtilization, criticalRisks, blockedDependencies) {
  let score = 100;

  // Deduct points for timeline issues
  if (timelineProgress > (project.progress?.percentage || 0) + 20) {
    score -= 15; // Behind schedule
  }

  // Deduct points for budget issues
  if (budgetUtilization > 100) {
    score -= 20; // Over budget
  } else if (budgetUtilization > 90) {
    score -= 10; // Near budget limit
  }

  // Deduct points for critical risks
  score -= criticalRisks * 10;

  // Deduct points for blocked dependencies
  score -= blockedDependencies * 5;

  // Deduct points if project is on-hold
  if (project.status === 'on-hold') {
    score -= 25;
  }

  return Math.max(0, Math.min(100, score));
}

// Helper function to get health status
function getHealthStatus(project, timelineProgress, budgetUtilization, criticalRisks) {
  if (project.status === 'completed') return 'completed';
  if (project.status === 'on-hold') return 'on-hold';

  const score = calculateHealthScore(project, timelineProgress, budgetUtilization, criticalRisks, 0);

  if (score >= 80) return 'healthy';
  if (score >= 60) return 'at-risk';
  return 'critical';
}

// Upload project attachment
exports.uploadAttachment = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Check if user has access
    const user = await User.findById(req.user._id);
    const isSuperAdmin = user.role === 'superadmin';
    const isOwner = project.owner.equals(req.user._id);
    const isMember = project.members.some(m => m.user.equals(req.user._id));

    if (!isSuperAdmin && !isOwner && !isMember) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const attachment = {
      name: req.file.originalname,
      url: `/uploads/project-files/${req.file.filename}`,
      size: req.file.size,
      type: req.file.mimetype,
      uploadedBy: req.user._id
    };

    project.attachments.push(attachment);
    await project.save();

    // Add activity log
    await project.addActivity(
      'file_uploaded',
      `Uploaded file: ${req.file.originalname}`,
      req.user._id,
      { fileName: req.file.originalname, fileSize: req.file.size }
    );

    res.json({ message: 'File uploaded successfully', attachment });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Delete project attachment
exports.deleteAttachment = async (req, res) => {
  try {
    const { attachmentId } = req.params;
    const project = await Project.findById(req.params.id);

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Check if user has access
    const user = await User.findById(req.user._id);
    const isSuperAdmin = user.role === 'superadmin';
    const isOwner = project.owner.equals(req.user._id);

    if (!isSuperAdmin && !isOwner) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const attachment = project.attachments.id(attachmentId);
    if (!attachment) {
      return res.status(404).json({ error: 'Attachment not found' });
    }

    const fileName = attachment.name;
    project.attachments.pull(attachmentId);
    await project.save();

    // Add activity log
    await project.addActivity(
      'file_deleted',
      `Deleted file: ${fileName}`,
      req.user._id,
      { fileName }
    );

    res.json({ message: 'Attachment deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==================== MILESTONE MANAGEMENT ====================

// Add a milestone to a project
exports.addMilestone = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, dueDate } = req.body;

    const project = await Project.findById(id);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Check if user is project owner or member
    const isOwner = project.owner.toString() === req.user._id.toString();
    const isMember = project.members.some(m => m.user.toString() === req.user._id.toString());

    if (!isOwner && !isMember) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const milestone = {
      title,
      description,
      dueDate: dueDate ? new Date(dueDate) : null,
      status: 'pending'
    };

    project.milestones.push(milestone);
    await project.addActivity('milestone_added', `Added milestone: ${title}`, req.user._id, { milestoneTitle: title });
    await project.save();

    res.json({ message: 'Milestone added successfully', milestone: project.milestones[project.milestones.length - 1] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Update a milestone
exports.updateMilestone = async (req, res) => {
  try {
    const { id, milestoneId } = req.params;
    const { title, description, dueDate, status } = req.body;

    const project = await Project.findById(id);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Check if user is project owner or member
    const isOwner = project.owner.toString() === req.user._id.toString();
    const isMember = project.members.some(m => m.user.toString() === req.user._id.toString());

    if (!isOwner && !isMember) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const milestone = project.milestones.id(milestoneId);
    if (!milestone) {
      return res.status(404).json({ error: 'Milestone not found' });
    }

    if (title) milestone.title = title;
    if (description !== undefined) milestone.description = description;
    if (dueDate) milestone.dueDate = new Date(dueDate);
    if (status) {
      milestone.status = status;
      if (status === 'completed') {
        milestone.completedAt = new Date();
      }
    }

    await project.addActivity('milestone_updated', `Updated milestone: ${milestone.title}`, req.user._id, { milestoneTitle: milestone.title });
    await project.save();

    res.json({ message: 'Milestone updated successfully', milestone });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Delete a milestone
exports.deleteMilestone = async (req, res) => {
  try {
    const { id, milestoneId } = req.params;

    const project = await Project.findById(id);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Check if user is project owner
    const isOwner = project.owner.toString() === req.user._id.toString();

    if (!isOwner) {
      return res.status(403).json({ error: 'Only project owner can delete milestones' });
    }

    const milestone = project.milestones.id(milestoneId);
    if (!milestone) {
      return res.status(404).json({ error: 'Milestone not found' });
    }

    const milestoneTitle = milestone.title;
    milestone.remove();

    await project.addActivity('milestone_deleted', `Deleted milestone: ${milestoneTitle}`, req.user._id, { milestoneTitle });
    await project.save();

    res.json({ message: 'Milestone deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==================== RISK MANAGEMENT ====================

// Add a risk to a project
exports.addRisk = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, severity, probability, mitigation } = req.body;

    const project = await Project.findById(id);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Check if user is project owner or member
    const isOwner = project.owner.toString() === req.user._id.toString();
    const isMember = project.members.some(m => m.user.toString() === req.user._id.toString());

    if (!isOwner && !isMember) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const risk = {
      title,
      description,
      severity: severity || 'medium',
      probability: probability || 'medium',
      mitigation: mitigation || '',
      status: 'identified'
    };

    project.risks.push(risk);
    await project.addActivity('risk_added', `Added risk: ${title}`, req.user._id, { riskTitle: title, severity });
    await project.save();

    res.json({ message: 'Risk added successfully', risk: project.risks[project.risks.length - 1] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Update a risk
exports.updateRisk = async (req, res) => {
  try {
    const { id, riskId } = req.params;
    const { title, description, severity, probability, mitigation, status } = req.body;

    const project = await Project.findById(id);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Check if user is project owner or member
    const isOwner = project.owner.toString() === req.user._id.toString();
    const isMember = project.members.some(m => m.user.toString() === req.user._id.toString());

    if (!isOwner && !isMember) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const risk = project.risks.id(riskId);
    if (!risk) {
      return res.status(404).json({ error: 'Risk not found' });
    }

    if (title) risk.title = title;
    if (description !== undefined) risk.description = description;
    if (severity) risk.severity = severity;
    if (probability) risk.probability = probability;
    if (mitigation !== undefined) risk.mitigation = mitigation;
    if (status) risk.status = status;

    await project.addActivity('risk_updated', `Updated risk: ${risk.title}`, req.user._id, { riskTitle: risk.title });
    await project.save();

    res.json({ message: 'Risk updated successfully', risk });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Delete a risk
exports.deleteRisk = async (req, res) => {
  try {
    const { id, riskId } = req.params;

    const project = await Project.findById(id);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Check if user is project owner
    const isOwner = project.owner.toString() === req.user._id.toString();

    if (!isOwner) {
      return res.status(403).json({ error: 'Only project owner can delete risks' });
    }

    const risk = project.risks.id(riskId);
    if (!risk) {
      return res.status(404).json({ error: 'Risk not found' });
    }

    const riskTitle = risk.title;
    risk.remove();

    await project.addActivity('risk_deleted', `Deleted risk: ${riskTitle}`, req.user._id, { riskTitle });
    await project.save();

    res.json({ message: 'Risk deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==================== DEPENDENCY MANAGEMENT ====================

// Add a dependency to a project
exports.addDependency = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, type, dueDate } = req.body;

    const project = await Project.findById(id);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Check if user is project owner or member
    const isOwner = project.owner.toString() === req.user._id.toString();
    const isMember = project.members.some(m => m.user.toString() === req.user._id.toString());

    if (!isOwner && !isMember) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const dependency = {
      title,
      description,
      type: type || 'internal',
      status: 'pending',
      dueDate: dueDate ? new Date(dueDate) : null
    };

    project.dependencies.push(dependency);
    await project.addActivity('dependency_added', `Added dependency: ${title}`, req.user._id, { dependencyTitle: title, type });
    await project.save();

    res.json({ message: 'Dependency added successfully', dependency: project.dependencies[project.dependencies.length - 1] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Update a dependency
exports.updateDependency = async (req, res) => {
  try {
    const { id, dependencyId } = req.params;
    const { title, description, type, status, dueDate } = req.body;

    const project = await Project.findById(id);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Check if user is project owner or member
    const isOwner = project.owner.toString() === req.user._id.toString();
    const isMember = project.members.some(m => m.user.toString() === req.user._id.toString());

    if (!isOwner && !isMember) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const dependency = project.dependencies.id(dependencyId);
    if (!dependency) {
      return res.status(404).json({ error: 'Dependency not found' });
    }

    if (title) dependency.title = title;
    if (description !== undefined) dependency.description = description;
    if (type) dependency.type = type;
    if (status) dependency.status = status;
    if (dueDate) dependency.dueDate = new Date(dueDate);

    await project.addActivity('dependency_updated', `Updated dependency: ${dependency.title}`, req.user._id, { dependencyTitle: dependency.title });
    await project.save();

    res.json({ message: 'Dependency updated successfully', dependency });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Delete a dependency
exports.deleteDependency = async (req, res) => {
  try {
    const { id, dependencyId } = req.params;

    const project = await Project.findById(id);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Check if user is project owner
    const isOwner = project.owner.toString() === req.user._id.toString();

    if (!isOwner) {
      return res.status(403).json({ error: 'Only project owner can delete dependencies' });
    }

    const dependency = project.dependencies.id(dependencyId);
    if (!dependency) {
      return res.status(404).json({ error: 'Dependency not found' });
    }

    const dependencyTitle = dependency.title;
    dependency.remove();

    await project.addActivity('dependency_deleted', `Deleted dependency: ${dependencyTitle}`, req.user._id, { dependencyTitle });
    await project.save();

    res.json({ message: 'Dependency deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==================== TAG MANAGEMENT ====================

// Add tags to a project
exports.addTags = async (req, res) => {
  try {
    const { id } = req.params;
    const { tags } = req.body;

    if (!Array.isArray(tags) || tags.length === 0) {
      return res.status(400).json({ error: 'Tags must be a non-empty array' });
    }

    const project = await Project.findById(id);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Check if user is project owner or member
    const isOwner = project.owner.toString() === req.user._id.toString();
    const isMember = project.members.some(m => m.user.toString() === req.user._id.toString());

    if (!isOwner && !isMember) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Add only unique tags
    const newTags = tags.filter(tag => !project.tags.includes(tag));
    project.tags.push(...newTags);

    await project.addActivity('tags_added', `Added tags: ${newTags.join(', ')}`, req.user._id, { tags: newTags });
    await project.save();

    res.json({ message: 'Tags added successfully', tags: project.tags });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Remove a tag from a project
exports.removeTag = async (req, res) => {
  try {
    const { id, tag } = req.params;

    const project = await Project.findById(id);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Check if user is project owner or member
    const isOwner = project.owner.toString() === req.user._id.toString();
    const isMember = project.members.some(m => m.user.toString() === req.user._id.toString());

    if (!isOwner && !isMember) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const tagIndex = project.tags.indexOf(tag);
    if (tagIndex === -1) {
      return res.status(404).json({ error: 'Tag not found' });
    }

    project.tags.splice(tagIndex, 1);

    await project.addActivity('tag_removed', `Removed tag: ${tag}`, req.user._id, { tag });
    await project.save();

    res.json({ message: 'Tag removed successfully', tags: project.tags });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Update project settings
exports.updateProjectSettings = async (req, res) => {
  try {
    const { id } = req.params;
    const { settings } = req.body;

    const project = await Project.findById(id);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Check if user is project owner or member
    const isOwner = project.owner.toString() === req.user._id.toString();
    const isMember = project.members.some(m => m.user.toString() === req.user._id.toString());

    if (!isOwner && !isMember) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Update settings
    if (!project.settings) {
      project.settings = {};
    }

    // Merge settings
    project.settings = {
      ...project.settings,
      ...settings
    };

    await project.addActivity('settings_updated', 'Project settings updated', req.user._id, { settings });
    await project.save();

    res.json({ message: 'Settings updated successfully', settings: project.settings });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Add holiday
exports.addHoliday = async (req, res) => {
  try {
    const { id } = req.params;
    const { date, name, description } = req.body;

    if (!date || !name) {
      return res.status(400).json({ error: 'Date and name are required' });
    }

    const project = await Project.findById(id);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Check if user is project owner or member
    const isOwner = project.owner.toString() === req.user._id.toString();
    const isMember = project.members.some(m => m.user.toString() === req.user._id.toString());

    if (!isOwner && !isMember) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Initialize settings if not exists
    if (!project.settings) {
      project.settings = {};
    }
    if (!project.settings.holidays) {
      project.settings.holidays = [];
    }

    project.settings.holidays.push({ date, name, description });

    await project.addActivity('holiday_added', `Added holiday: ${name}`, req.user._id, { date, name });
    await project.save();

    res.json({ message: 'Holiday added successfully', holidays: project.settings.holidays });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Remove holiday
exports.removeHoliday = async (req, res) => {
  try {
    const { id, holidayId } = req.params;

    const project = await Project.findById(id);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Check if user is project owner or member
    const isOwner = project.owner.toString() === req.user._id.toString();
    const isMember = project.members.some(m => m.user.toString() === req.user._id.toString());

    if (!isOwner && !isMember) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (!project.settings || !project.settings.holidays) {
      return res.status(404).json({ error: 'No holidays found' });
    }

    const holiday = project.settings.holidays.id(holidayId);
    if (!holiday) {
      return res.status(404).json({ error: 'Holiday not found' });
    }

    const holidayName = holiday.name;
    holiday.remove();

    await project.addActivity('holiday_removed', `Removed holiday: ${holidayName}`, req.user._id);
    await project.save();

    res.json({ message: 'Holiday removed successfully', holidays: project.settings.holidays });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};