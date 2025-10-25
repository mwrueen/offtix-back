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