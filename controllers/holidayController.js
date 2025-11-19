const Company = require('../models/Company');
const User = require('../models/User');

// Get all holidays for a company
exports.getCompanyHolidays = async (req, res) => {
  try {
    const { companyId } = req.params;
    
    if (!companyId) {
      return res.status(400).json({ error: 'Company ID is required' });
    }

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

    const holidays = company.settings?.holidays || [];
    
    // Sort holidays by date
    holidays.sort((a, b) => new Date(a.date) - new Date(b.date));

    res.json({
      company: {
        _id: company._id,
        name: company.name
      },
      holidays
    });
  } catch (error) {
    console.error('Error getting company holidays:', error);
    res.status(500).json({ error: 'Error getting company holidays: ' + error.message });
  }
};

// Add a holiday to company
exports.addHoliday = async (req, res) => {
  try {
    const { companyId } = req.params;
    const { date, name, description } = req.body;
    
    if (!date || !name) {
      return res.status(400).json({ error: 'Date and name are required' });
    }

    const company = await Company.findById(companyId);
    
    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    // Check permissions
    const user = await User.findById(req.user._id);
    const userMember = company.members.find(m => m.user.toString() === req.user._id.toString());
    const userDesignation = userMember ? company.designations.find(d => d.name === userMember.designation) : null;
    
    const canManageSettings = user.role === 'superadmin' || 
                             company.owner.toString() === req.user._id.toString() ||
                             (userDesignation && userDesignation.permissions.manageCompanySettings);
    
    if (!canManageSettings) {
      return res.status(403).json({ error: 'You do not have permission to manage company settings' });
    }

    // Initialize settings if not exists
    if (!company.settings) {
      company.settings = {};
    }
    if (!company.settings.holidays) {
      company.settings.holidays = [];
    }

    // Check if holiday already exists on this date
    const existingHoliday = company.settings.holidays.find(
      h => new Date(h.date).toDateString() === new Date(date).toDateString()
    );

    if (existingHoliday) {
      return res.status(400).json({ error: 'A holiday already exists on this date' });
    }

    // Add holiday
    company.settings.holidays.push({
      date: new Date(date),
      name,
      description: description || ''
    });

    await company.save();

    res.json({
      message: 'Holiday added successfully',
      holidays: company.settings.holidays
    });
  } catch (error) {
    console.error('Error adding holiday:', error);
    res.status(400).json({ error: error.message });
  }
};

// Update a holiday
exports.updateHoliday = async (req, res) => {
  try {
    const { companyId, holidayId } = req.params;
    const { date, name, description } = req.body;
    
    const company = await Company.findById(companyId);
    
    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    // Check permissions
    const user = await User.findById(req.user._id);
    const userMember = company.members.find(m => m.user.toString() === req.user._id.toString());
    const userDesignation = userMember ? company.designations.find(d => d.name === userMember.designation) : null;
    
    const canManageSettings = user.role === 'superadmin' || 
                             company.owner.toString() === req.user._id.toString() ||
                             (userDesignation && userDesignation.permissions.manageCompanySettings);
    
    if (!canManageSettings) {
      return res.status(403).json({ error: 'You do not have permission to manage company settings' });
    }

    if (!company.settings || !company.settings.holidays) {
      return res.status(404).json({ error: 'No holidays found' });
    }

    // Find holiday
    const holiday = company.settings.holidays.id(holidayId);
    if (!holiday) {
      return res.status(404).json({ error: 'Holiday not found' });
    }

    // Update holiday
    if (date) holiday.date = new Date(date);
    if (name) holiday.name = name;
    if (description !== undefined) holiday.description = description;

    await company.save();

    res.json({
      message: 'Holiday updated successfully',
      holidays: company.settings.holidays
    });
  } catch (error) {
    console.error('Error updating holiday:', error);
    res.status(400).json({ error: error.message });
  }
};

// Delete a holiday
exports.deleteHoliday = async (req, res) => {
  try {
    const { companyId, holidayId } = req.params;
    
    const company = await Company.findById(companyId);
    
    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    // Check permissions
    const user = await User.findById(req.user._id);
    const userMember = company.members.find(m => m.user.toString() === req.user._id.toString());
    const userDesignation = userMember ? company.designations.find(d => d.name === userMember.designation) : null;
    
    const canManageSettings = user.role === 'superadmin' || 
                             company.owner.toString() === req.user._id.toString() ||
                             (userDesignation && userDesignation.permissions.manageCompanySettings);
    
    if (!canManageSettings) {
      return res.status(403).json({ error: 'You do not have permission to manage company settings' });
    }

    if (!company.settings || !company.settings.holidays) {
      return res.status(404).json({ error: 'No holidays found' });
    }

    // Find and remove holiday
    const holiday = company.settings.holidays.id(holidayId);
    if (!holiday) {
      return res.status(404).json({ error: 'Holiday not found' });
    }

    holiday.deleteOne();
    await company.save();

    res.json({
      message: 'Holiday deleted successfully',
      holidays: company.settings.holidays
    });
  } catch (error) {
    console.error('Error deleting holiday:', error);
    res.status(400).json({ error: error.message });
  }
};

// Get upcoming holidays
exports.getUpcomingHolidays = async (req, res) => {
  try {
    const { companyId } = req.params;
    const { limit = 5 } = req.query;
    
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

    const holidays = company.settings?.holidays || [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Filter upcoming holidays and sort by date
    const upcomingHolidays = holidays
      .filter(h => new Date(h.date) >= today)
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .slice(0, parseInt(limit));

    res.json({
      company: {
        _id: company._id,
        name: company.name
      },
      holidays: upcomingHolidays
    });
  } catch (error) {
    console.error('Error getting upcoming holidays:', error);
    res.status(500).json({ error: 'Error getting upcoming holidays: ' + error.message });
  }
};

