const asyncHandler = require('../utils/asyncHandler');
const leaveService = require('../services/leaveService');

exports.getCompanyLeaves = asyncHandler(async (req, res) => {
  const { status, employeeId, startDate, endDate } = req.query;
  const result = await leaveService.getCompanyLeaves(req.params.companyId, { status, employeeId, startDate, endDate });
  res.json(result);
});

exports.getLeaveDetails = asyncHandler(async (req, res) => {
  const result = await leaveService.getLeaveDetails(req.params.companyId, req.params.leaveId);
  res.json(result);
});

exports.requestLeave = asyncHandler(async (req, res) => {
  const result = await leaveService.requestLeave(req.params.companyId, req.user._id, req.body);
  res.status(201).json(result);
});

exports.updateLeaveRequest = asyncHandler(async (req, res) => {
  const result = await leaveService.updateLeaveRequest(req.params.companyId, req.params.leaveId, req.user._id, req.body);
  res.json(result);
});

exports.updateLeaveStatus = asyncHandler(async (req, res) => {
  const result = await leaveService.updateLeaveStatus(req.params.companyId, req.params.leaveId, req.user._id, req.body);
  res.json(result);
});

exports.cancelLeave = asyncHandler(async (req, res) => {
  const result = await leaveService.cancelLeave(req.params.companyId, req.params.leaveId, req.user._id);
  res.json(result);
});

exports.getLeaveBalance = asyncHandler(async (req, res) => {
  const result = await leaveService.getLeaveBalance(req.params.companyId, req.params.employeeId, req.query.year);
  res.json(result);
});

exports.getLeaveStatistics = asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;
  const result = await leaveService.getLeaveStatistics(req.params.companyId, { startDate, endDate });
  res.json(result);
});

