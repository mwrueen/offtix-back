const Leave = require('../models/Leave');
const Company = require('../models/Company');
const User = require('../models/User');

// Get all leaves for a company
exports.getCompanyLeaves = async (req, res) => {
  try {
    const { companyId } = req.params;
    const { status, employeeId, startDate, endDate } = req.query;

    // Build query
    const query = { company: companyId };
    if (status) query.status = status;
    if (employeeId) query.employee = employeeId;
    if (startDate || endDate) {
      query.startDate = {};
      if (startDate) query.startDate.$gte = new Date(startDate);
      if (endDate) query.startDate.$lte = new Date(endDate);
    }

    const leaves = await Leave.find(query)
      .populate('employee', 'name email profilePicture')
      .populate('approvedBy', 'name email')
      .sort({ startDate: -1 });

    res.json({ leaves });
  } catch (error) {
    console.error('Error fetching leaves:', error);
    res.status(500).json({ error: 'Failed to fetch leaves' });
  }
};

// Get leave details
exports.getLeaveDetails = async (req, res) => {
  try {
    const { companyId, leaveId } = req.params;

    const leave = await Leave.findOne({ _id: leaveId, company: companyId })
      .populate('employee', 'name email profilePicture')
      .populate('approvedBy', 'name email');

    if (!leave) {
      return res.status(404).json({ error: 'Leave not found' });
    }

    res.json({ leave });
  } catch (error) {
    console.error('Error fetching leave details:', error);
    res.status(500).json({ error: 'Failed to fetch leave details' });
  }
};

// Request leave
exports.requestLeave = async (req, res) => {
  try {
    const { companyId } = req.params;
    const { leaveType, startDate, endDate, halfDay, halfDayPeriod, reason, notes } = req.body;

    // Validate dates
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (start > end) {
      return res.status(400).json({ error: 'Start date must be before end date' });
    }

    // Calculate total days
    const diffTime = Math.abs(end - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    const calculatedTotalDays = halfDay ? 0.5 : diffDays;

    // Check for overlapping leaves
    const overlappingLeave = await Leave.findOne({
      company: companyId,
      employee: req.user._id,
      status: { $in: ['pending', 'approved'] },
      $or: [
        { startDate: { $lte: end }, endDate: { $gte: start } }
      ]
    });

    if (overlappingLeave) {
      return res.status(400).json({ error: 'You already have a leave request for this period' });
    }

    const leave = new Leave({
      company: companyId,
      employee: req.user._id,
      leaveType,
      startDate: start,
      endDate: end,
      halfDay: halfDay || false,
      halfDayPeriod: halfDay ? halfDayPeriod : null,
      totalDays: calculatedTotalDays,
      reason,
      notes
    });

    await leave.save();
    await leave.populate('employee', 'name email profilePicture');

    res.status(201).json({ leave, message: 'Leave request submitted successfully' });
  } catch (error) {
    console.error('Error requesting leave:', error);
    res.status(500).json({ error: 'Failed to submit leave request' });
  }
};

// Update leave request (only by employee who created it, and only if pending)
exports.updateLeaveRequest = async (req, res) => {
  try {
    const { companyId, leaveId } = req.params;
    const { leaveType, startDate, endDate, halfDay, halfDayPeriod, reason, notes } = req.body;

    const leave = await Leave.findOne({ _id: leaveId, company: companyId });

    if (!leave) {
      return res.status(404).json({ error: 'Leave not found' });
    }

    // Only the employee who created the leave can update it
    if (leave.employee.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'You can only update your own leave requests' });
    }

    // Can only update pending leaves
    if (leave.status !== 'pending') {
      return res.status(400).json({ error: 'Can only update pending leave requests' });
    }

    // Validate dates if provided
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      if (start > end) {
        return res.status(400).json({ error: 'Start date must be before end date' });
      }
      leave.startDate = start;
      leave.endDate = end;

      // Recalculate total days
      const diffTime = Math.abs(end - start);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
      leave.totalDays = (halfDay !== undefined ? halfDay : leave.halfDay) ? 0.5 : diffDays;
    }

    if (leaveType) leave.leaveType = leaveType;
    if (halfDay !== undefined) {
      leave.halfDay = halfDay;
      // Recalculate total days if halfDay changes
      if (leave.startDate && leave.endDate) {
        const start = new Date(leave.startDate);
        const end = new Date(leave.endDate);
        const diffTime = Math.abs(end - start);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
        leave.totalDays = halfDay ? 0.5 : diffDays;
      }
    }
    if (halfDayPeriod) leave.halfDayPeriod = halfDayPeriod;
    if (reason) leave.reason = reason;
    if (notes !== undefined) leave.notes = notes;

    await leave.save();
    await leave.populate('employee', 'name email profilePicture');

    res.json({ leave, message: 'Leave request updated successfully' });
  } catch (error) {
    console.error('Error updating leave request:', error);
    res.status(500).json({ error: 'Failed to update leave request' });
  }
};

// Approve/Reject leave
exports.updateLeaveStatus = async (req, res) => {
  try {
    const { companyId, leaveId } = req.params;
    const { status, rejectionReason } = req.body;

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const leave = await Leave.findOne({ _id: leaveId, company: companyId });

    if (!leave) {
      return res.status(404).json({ error: 'Leave not found' });
    }

    // Check if user has permission to approve leaves
    const company = await Company.findById(companyId);
    const member = company.members.find(m => m.user.toString() === req.user._id.toString());
    const isOwner = company.owner.toString() === req.user._id.toString();
    
    let hasPermission = isOwner;
    if (member) {
      const designation = company.designations.find(d => d.name === member.designation);
      hasPermission = hasPermission || (designation && designation.permissions.manageCompanySettings);
    }

    if (!hasPermission) {
      return res.status(403).json({ error: 'You do not have permission to approve/reject leaves' });
    }

    leave.status = status;
    leave.approvedBy = req.user._id;
    leave.approvedAt = new Date();
    if (status === 'rejected' && rejectionReason) {
      leave.rejectionReason = rejectionReason;
    }

    await leave.save();
    await leave.populate(['employee', 'approvedBy']);

    res.json({ leave, message: `Leave ${status} successfully` });
  } catch (error) {
    console.error('Error updating leave status:', error);
    res.status(500).json({ error: 'Failed to update leave status' });
  }
};

// Cancel leave (by employee)
exports.cancelLeave = async (req, res) => {
  try {
    const { companyId, leaveId } = req.params;

    const leave = await Leave.findOne({ _id: leaveId, company: companyId });

    if (!leave) {
      return res.status(404).json({ error: 'Leave not found' });
    }

    // Only the employee who created the leave can cancel it
    if (leave.employee.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'You can only cancel your own leave requests' });
    }

    // Can only cancel pending or approved leaves
    if (!['pending', 'approved'].includes(leave.status)) {
      return res.status(400).json({ error: 'Can only cancel pending or approved leaves' });
    }

    leave.status = 'cancelled';
    await leave.save();

    res.json({ leave, message: 'Leave cancelled successfully' });
  } catch (error) {
    console.error('Error cancelling leave:', error);
    res.status(500).json({ error: 'Failed to cancel leave' });
  }
};

// Get leave balance for an employee
exports.getLeaveBalance = async (req, res) => {
  try {
    const { companyId, employeeId } = req.params;
    const year = req.query.year || new Date().getFullYear();

    const startOfYear = new Date(year, 0, 1);
    const endOfYear = new Date(year, 11, 31);

    const leaves = await Leave.find({
      company: companyId,
      employee: employeeId,
      status: 'approved',
      startDate: { $gte: startOfYear, $lte: endOfYear }
    });

    // Calculate leave balance by type
    const balance = {
      sick: { taken: 0, total: 10 },
      casual: { taken: 0, total: 12 },
      annual: { taken: 0, total: 20 },
      maternity: { taken: 0, total: 90 },
      paternity: { taken: 0, total: 15 },
      unpaid: { taken: 0, total: Infinity },
      other: { taken: 0, total: 0 }
    };

    leaves.forEach(leave => {
      if (balance[leave.leaveType]) {
        balance[leave.leaveType].taken += leave.totalDays;
      }
    });

    // Calculate remaining
    Object.keys(balance).forEach(type => {
      balance[type].remaining = balance[type].total === Infinity 
        ? Infinity 
        : balance[type].total - balance[type].taken;
    });

    res.json({ balance, year });
  } catch (error) {
    console.error('Error fetching leave balance:', error);
    res.status(500).json({ error: 'Failed to fetch leave balance' });
  }
};

// Get leave statistics for company
exports.getLeaveStatistics = async (req, res) => {
  try {
    const { companyId } = req.params;
    const { startDate, endDate } = req.query;

    const query = { company: companyId };
    if (startDate || endDate) {
      query.startDate = {};
      if (startDate) query.startDate.$gte = new Date(startDate);
      if (endDate) query.startDate.$lte = new Date(endDate);
    }

    const leaves = await Leave.find(query);

    const stats = {
      total: leaves.length,
      pending: leaves.filter(l => l.status === 'pending').length,
      approved: leaves.filter(l => l.status === 'approved').length,
      rejected: leaves.filter(l => l.status === 'rejected').length,
      cancelled: leaves.filter(l => l.status === 'cancelled').length,
      byType: {}
    };

    // Group by leave type
    leaves.forEach(leave => {
      if (!stats.byType[leave.leaveType]) {
        stats.byType[leave.leaveType] = { count: 0, days: 0 };
      }
      stats.byType[leave.leaveType].count++;
      stats.byType[leave.leaveType].days += leave.totalDays;
    });

    res.json({ stats });
  } catch (error) {
    console.error('Error fetching leave statistics:', error);
    res.status(500).json({ error: 'Failed to fetch leave statistics' });
  }
};

