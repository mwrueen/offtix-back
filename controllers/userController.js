const User = require('../models/User');
const { validationResult } = require('express-validator');

exports.getUsers = async (req, res) => {
  try {
    const companyId = req.headers['x-company-id'] || req.query.companyId;
    let query = {};

    if (companyId && companyId !== 'personal') {
      try {
        // Filter users by company
        const Company = require('../models/Company');
        const company = await Company.findById(companyId);
        
        if (!company) {
          console.log('Company not found:', companyId);
          return res.status(404).json({ error: 'Company not found' });
        }

        // Check if user has access to this company
        const hasCompanyAccess = company.owner.toString() === req.user._id.toString() ||
                                company.members.some(member => member.user.toString() === req.user._id.toString());
        
        if (!hasCompanyAccess) {
          console.log('Access denied to company:', companyId, 'for user:', req.user._id);
          return res.status(403).json({ error: 'Access denied to this company' });
        }

        // Get company owner and members
        const companyUserIds = [
          company.owner,
          ...company.members.map(member => member.user)
        ];
        
        // Debug logging
        console.log('User Controller Debug:', {
          companyId,
          companyName: company.name,
          companyOwner: company.owner,
          companyMembers: company.members.length,
          companyUserIds: companyUserIds.length,
          requestingUser: req.user._id
        });
        
        query = { _id: { $in: companyUserIds } };
      } catch (error) {
        console.error('Error filtering users by company:', error);
        return res.status(500).json({ error: 'Error filtering users by company: ' + error.message });
      }
    } else {
      // Personal mode - return all users (for backward compatibility)
      // In a real app, you might want to restrict this further
      query = {};
    }

    const users = await User.find(query).select('-password');
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.createUser = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const user = new User(req.body);
    await user.save();
    res.status(201).json(user);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateUser = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get company employees (simplified endpoint)
exports.getCompanyEmployees = async (req, res) => {
  try {
    const { companyId } = req.params;
    
    if (!companyId) {
      return res.status(400).json({ error: 'Company ID is required' });
    }

    const Company = require('../models/Company');
    const company = await Company.findById(companyId);
    
    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    // Check if user has access to this company
    const hasCompanyAccess = company.owner.toString() === req.user._id.toString() ||
                            company.members.some(member => member.user.toString() === req.user._id.toString());
    
    if (!hasCompanyAccess) {
      return res.status(403).json({ error: 'Access denied to this company' });
    }

    // Get all company user IDs (owner + members)
    const companyUserIds = [
      company.owner,
      ...company.members.map(member => member.user)
    ];

    // Get user details
    const users = await User.find({ _id: { $in: companyUserIds } }).select('-password');
    
    console.log('Company Employees Debug:', {
      companyId,
      companyName: company.name,
      totalEmployees: users.length,
      employees: users.map(u => ({ id: u._id, name: u.name, email: u.email }))
    });

    res.json(users);
  } catch (error) {
    console.error('Error getting company employees:', error);
    res.status(500).json({ error: 'Error getting company employees: ' + error.message });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const { name, profile } = req.body;
    
    // Remove base64 images from profile data - don't save them to database
    const cleanProfile = { ...profile };
    if (cleanProfile.profilePicture && cleanProfile.profilePicture.startsWith('data:')) {
      delete cleanProfile.profilePicture;
    }
    if (cleanProfile.coverPhoto && cleanProfile.coverPhoto.startsWith('data:')) {
      delete cleanProfile.coverPhoto;
    }
    
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { name, profile: cleanProfile },
      { new: true }
    ).select('-password');
    
    res.json(user);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.uploadPhoto = async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const updateData = {};
    
    if (req.files.profilePicture) {
      const file = req.files.profilePicture[0];
      updateData['profile.profilePicture'] = `/uploads/profile-pictures/${file.filename}`;
    }
    
    if (req.files.coverPhoto) {
      const file = req.files.coverPhoto[0];
      updateData['profile.coverPhoto'] = `/uploads/cover-photos/${file.filename}`;
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: updateData },
      { new: true }
    ).select('-password');

    res.json(updatedUser);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};