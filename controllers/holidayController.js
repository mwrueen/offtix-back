const asyncHandler = require('../utils/asyncHandler');
const holidayService = require('../services/holidayService');

exports.getCompanyHolidays = asyncHandler(async (req, res) => {
  const result = await holidayService.getCompanyHolidays(req.params.companyId, req.user._id);
  res.json(result);
});

exports.addHoliday = asyncHandler(async (req, res) => {
  const result = await holidayService.addHoliday(req.params.companyId, req.user._id, req.body);
  res.json(result);
});

exports.updateHoliday = asyncHandler(async (req, res) => {
  const result = await holidayService.updateHoliday(req.params.companyId, req.params.holidayId, req.user._id, req.body);
  res.json(result);
});

exports.deleteHoliday = asyncHandler(async (req, res) => {
  const result = await holidayService.deleteHoliday(req.params.companyId, req.params.holidayId, req.user._id);
  res.json(result);
});

exports.getUpcomingHolidays = asyncHandler(async (req, res) => {
  const result = await holidayService.getUpcomingHolidays(req.params.companyId, req.user._id, req.query.limit);
  res.json(result);
});

