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

    // Sort holidays by date (use startDate for range holidays, date for single-day holidays)
    holidays.sort((a, b) => {
      const dateA = a.isRange ? new Date(a.startDate) : new Date(a.date);
      const dateB = b.isRange ? new Date(b.startDate) : new Date(b.date);
      return dateA - dateB;
    });

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
    const { date, startDate, endDate, name, description, isRange } = req.body;

    // Validate: either date OR (startDate AND endDate) must be provided
    if (!name) {
      return res.status(400).json({ error: 'Holiday name is required' });
    }

    if (isRange) {
      if (!startDate || !endDate) {
        return res.status(400).json({ error: 'Start date and end date are required for date range holidays' });
      }
    } else {
      if (!date) {
        return res.status(400).json({ error: 'Date is required for single-day holidays' });
      }
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

    // Parse dates to avoid timezone issues
    const parseDate = (dateStr) => {
      if (!dateStr) return null;
      if (dateStr.includes('T')) {
        return new Date(dateStr);
      } else {
        const [year, month, day] = dateStr.split('-').map(Number);
        return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
      }
    };

    // Create holiday data object with all fields explicitly defined
    let holidayData;

    if (isRange) {
      const parsedStartDate = parseDate(startDate);
      const parsedEndDate = parseDate(endDate);

      // Validate that endDate is after startDate
      if (parsedEndDate < parsedStartDate) {
        return res.status(400).json({ error: 'End date must be after start date' });
      }

      holidayData = {
        name: name,
        description: description || '',
        isRange: true,
        startDate: parsedStartDate,
        endDate: parsedEndDate
        // Explicitly NOT including 'date' field for range holidays
      };

      console.log('Creating range holiday:', JSON.stringify(holidayData, null, 2));
    } else {
      holidayData = {
        name: name,
        description: description || '',
        isRange: false,
        date: parseDate(date)
        // Explicitly NOT including 'startDate' and 'endDate' for single-day holidays
      };

      console.log('Creating single-day holiday:', JSON.stringify(holidayData, null, 2));
    }

    // Add holiday
    console.log('Holiday data before push:', JSON.stringify(holidayData, null, 2));
    company.settings.holidays.push(holidayData);

    // Mark the path as modified to ensure Mongoose saves it
    company.markModified('settings.holidays');

    const savedCompany = await company.save();

    const savedHoliday = savedCompany.settings.holidays[savedCompany.settings.holidays.length - 1];
    console.log('Saved holiday:', JSON.stringify(savedHoliday, null, 2));

    res.json({
      message: 'Holiday added successfully',
      holidays: savedCompany.settings.holidays
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
    const { date, startDate, endDate, name, description, isRange } = req.body;
    
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

    // Helper function to parse dates
    const parseDate = (dateStr) => {
      if (!dateStr) return null;
      if (dateStr.includes('T')) {
        return new Date(dateStr);
      } else {
        const [year, month, day] = dateStr.split('-').map(Number);
        return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
      }
    };

    // Update holiday
    if (isRange !== undefined) {
      holiday.isRange = isRange;
      if (isRange) {
        // Update to range holiday
        if (startDate) holiday.startDate = parseDate(startDate);
        if (endDate) holiday.endDate = parseDate(endDate);
        holiday.date = undefined;  // Clear single date
      } else {
        // Update to single-day holiday
        if (date) holiday.date = parseDate(date);
        holiday.startDate = undefined;  // Clear range dates
        holiday.endDate = undefined;
      }
    } else {
      // Update existing type
      if (holiday.isRange) {
        if (startDate) holiday.startDate = parseDate(startDate);
        if (endDate) holiday.endDate = parseDate(endDate);
      } else {
        if (date) holiday.date = parseDate(date);
      }
    }

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
      .filter(h => {
        const holidayDate = h.isRange ? new Date(h.startDate) : new Date(h.date);
        return holidayDate >= today;
      })
      .sort((a, b) => {
        const dateA = a.isRange ? new Date(a.startDate) : new Date(a.date);
        const dateB = b.isRange ? new Date(b.startDate) : new Date(b.date);
        return dateA - dateB;
      })
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

