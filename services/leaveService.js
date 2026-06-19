const Leave = require('../models/Leave');
const Company = require('../models/Company');
const ApiError = require('../utils/ApiError');

const LEAVE_BALANCE = {
  sick: { total: 10 },
  casual: { total: 12 },
  annual: { total: 20 },
  maternity: { total: 90 },
  paternity: { total: 15 },
  unpaid: { total: Infinity },
  other: { total: 0 }
};

const calculateDays = (start, end, halfDay) => {
  const diffTime = Math.abs(new Date(end) - new Date(start));
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  return halfDay ? 0.5 : diffDays;
};

const buildLeaveQuery = (companyId, filters) => {
  const query = { company: companyId };
  if (filters.status) query.status = filters.status;
  if (filters.employeeId) query.employee = filters.employeeId;
  if (filters.startDate || filters.endDate) {
    query.startDate = {};
    if (filters.startDate) query.startDate.$gte = new Date(filters.startDate);
    if (filters.endDate) query.startDate.$lte = new Date(filters.endDate);
  }
  return query;
};

const getCompanyLeaves = async (companyId, filters) => {
  const leaves = await Leave.find(buildLeaveQuery(companyId, filters))
    .populate('employee', 'name email profilePicture')
    .populate('approvedBy', 'name email')
    .sort({ startDate: -1 });
  return { leaves };
};

const getLeaveDetails = async (companyId, leaveId) => {
  const leave = await Leave.findOne({ _id: leaveId, company: companyId })
    .populate('employee', 'name email profilePicture')
    .populate('approvedBy', 'name email');
  if (!leave) throw ApiError.notFound('Leave not found');
  return { leave };
};

const requestLeave = async (companyId, userId, body) => {
  const { leaveType, startDate, endDate, halfDay, halfDayPeriod, reason, notes } = body;
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (start > end) throw ApiError.badRequest('Start date must be before end date');
  const totalDays = calculateDays(start, end, halfDay);

  const overlapping = await Leave.findOne({
    company: companyId,
    employee: userId,
    status: { $in: ['pending', 'approved'] },
    startDate: { $lte: end },
    endDate: { $gte: start }
  });
  if (overlapping) throw ApiError.badRequest('You already have a leave request for this period');

  const leave = new Leave({
    company: companyId,
    employee: userId,
    leaveType,
    startDate: start,
    endDate: end,
    halfDay: halfDay || false,
    halfDayPeriod: halfDay ? halfDayPeriod : null,
    totalDays,
    reason,
    notes
  });
  await leave.save();
  await leave.populate('employee', 'name email profilePicture');
  return { leave, message: 'Leave request submitted successfully' };
};

const updateLeaveRequest = async (companyId, leaveId, userId, body) => {
  const { leaveType, startDate, endDate, halfDay, halfDayPeriod, reason, notes } = body;
  const leave = await Leave.findOne({ _id: leaveId, company: companyId });
  if (!leave) throw ApiError.notFound('Leave not found');
  if (leave.employee.toString() !== userId.toString()) {
    throw ApiError.forbidden('You can only update your own leave requests');
  }
  if (leave.status !== 'pending') throw ApiError.badRequest('Can only update pending leave requests');

  if (startDate && endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (start > end) throw ApiError.badRequest('Start date must be before end date');
    leave.startDate = start;
    leave.endDate = end;
    leave.totalDays = calculateDays(start, end, halfDay !== undefined ? halfDay : leave.halfDay);
  }
  if (leaveType) leave.leaveType = leaveType;
  if (halfDay !== undefined) {
    leave.halfDay = halfDay;
    if (leave.startDate && leave.endDate) {
      leave.totalDays = calculateDays(leave.startDate, leave.endDate, halfDay);
    }
  }
  if (halfDayPeriod) leave.halfDayPeriod = halfDayPeriod;
  if (reason) leave.reason = reason;
  if (notes !== undefined) leave.notes = notes;

  await leave.save();
  await leave.populate('employee', 'name email profilePicture');
  return { leave, message: 'Leave request updated successfully' };
};

const updateLeaveStatus = async (companyId, leaveId, userId, { status, rejectionReason }) => {
  if (!['approved', 'rejected'].includes(status)) throw ApiError.badRequest('Invalid status');
  const leave = await Leave.findOne({ _id: leaveId, company: companyId });
  if (!leave) throw ApiError.notFound('Leave not found');

  const company = await Company.findById(companyId);
  const member = company.members.find((m) => m.user.toString() === userId.toString());
  const isOwner = company.owner.toString() === userId.toString();
  let hasPermission = isOwner;
  if (member) {
    const designation = company.designations.find((d) => d.name === member.designation);
    hasPermission = hasPermission || (designation && designation.permissions.manageCompanySettings);
  }
  if (!hasPermission) throw ApiError.forbidden('You do not have permission to approve/reject leaves');

  leave.status = status;
  leave.approvedBy = userId;
  leave.approvedAt = new Date();
  if (status === 'rejected' && rejectionReason) leave.rejectionReason = rejectionReason;

  await leave.save();
  await leave.populate(['employee', 'approvedBy']);
  return { leave, message: `Leave ${status} successfully` };
};

const cancelLeave = async (companyId, leaveId, userId) => {
  const leave = await Leave.findOne({ _id: leaveId, company: companyId });
  if (!leave) throw ApiError.notFound('Leave not found');
  if (leave.employee.toString() !== userId.toString()) {
    throw ApiError.forbidden('You can only cancel your own leave requests');
  }
  if (!['pending', 'approved'].includes(leave.status)) {
    throw ApiError.badRequest('Can only cancel pending or approved leaves');
  }
  leave.status = 'cancelled';
  await leave.save();
  return { leave, message: 'Leave cancelled successfully' };
};

const getLeaveBalance = async (companyId, employeeId, year) => {
  const selectedYear = year || new Date().getFullYear();
  const startOfYear = new Date(selectedYear, 0, 1);
  const endOfYear = new Date(selectedYear, 11, 31);
  const leaves = await Leave.find({
    company: companyId,
    employee: employeeId,
    status: 'approved',
    startDate: { $gte: startOfYear, $lte: endOfYear }
  });

  const balance = {};
  Object.keys(LEAVE_BALANCE).forEach((type) => {
    balance[type] = { taken: 0, total: LEAVE_BALANCE[type].total };
  });
  leaves.forEach((leave) => {
    if (balance[leave.leaveType]) balance[leave.leaveType].taken += leave.totalDays;
  });
  Object.keys(balance).forEach((type) => {
    balance[type].remaining = balance[type].total === Infinity ? Infinity : balance[type].total - balance[type].taken;
  });
  return { balance, year: selectedYear };
};

const getLeaveStatistics = async (companyId, filters) => {
  const query = { company: companyId };
  if (filters.startDate || filters.endDate) {
    query.startDate = {};
    if (filters.startDate) query.startDate.$gte = new Date(filters.startDate);
    if (filters.endDate) query.startDate.$lte = new Date(filters.endDate);
  }
  const leaves = await Leave.find(query);
  const stats = {
    total: leaves.length,
    pending: leaves.filter((l) => l.status === 'pending').length,
    approved: leaves.filter((l) => l.status === 'approved').length,
    rejected: leaves.filter((l) => l.status === 'rejected').length,
    cancelled: leaves.filter((l) => l.status === 'cancelled').length,
    byType: {}
  };
  leaves.forEach((leave) => {
    if (!stats.byType[leave.leaveType]) stats.byType[leave.leaveType] = { count: 0, days: 0 };
    stats.byType[leave.leaveType].count++;
    stats.byType[leave.leaveType].days += leave.totalDays;
  });
  return { stats };
};

module.exports = {
  getCompanyLeaves,
  getLeaveDetails,
  requestLeave,
  updateLeaveRequest,
  updateLeaveStatus,
  cancelLeave,
  getLeaveBalance,
  getLeaveStatistics
};
