const asyncHandler = require('../utils/asyncHandler');
const recruitmentService = require('../services/recruitmentService');

exports.createCircular = asyncHandler(async (req, res) => {
  const circular = await recruitmentService.createCircular(req.user, req.body);
  res.status(201).json(circular);
});

exports.getPublicCirculars = asyncHandler(async (req, res) => {
  const circulars = await recruitmentService.getPublicCirculars();
  res.json(circulars);
});

exports.getCircularDetails = asyncHandler(async (req, res) => {
  const circular = await recruitmentService.getCircularDetails(req.params.id, req.user);
  res.json(circular);
});

exports.applyForJob = asyncHandler(async (req, res) => {
  const result = await recruitmentService.applyForJob(req.user, req.params.id, req.body);
  res.status(201).json(result);
});

exports.getApplicants = asyncHandler(async (req, res) => {
  const applicants = await recruitmentService.getApplicants(req.user, req.params.id);
  res.json(applicants);
});

exports.getApplicationById = asyncHandler(async (req, res) => {
  const application = await recruitmentService.getApplicationById(req.user, req.params.id);
  res.json(application);
});

exports.updateApplicationStatus = asyncHandler(async (req, res) => {
  const application = await recruitmentService.updateApplicationStatus(req.user, req.params.id, req.body);
  res.json(application);
});

exports.hireCandidate = asyncHandler(async (req, res) => {
  const result = await recruitmentService.hireCandidate(req.user, req.params.id, req.body);
  res.json(result);
});

exports.getOfferLetterDetails = asyncHandler(async (req, res) => {
  const details = await recruitmentService.getOfferLetterDetails(req.user, req.params.id);
  res.json(details);
});

exports.acceptOfferLetter = asyncHandler(async (req, res) => {
  const result = await recruitmentService.acceptOfferLetter(req.user, req.params.id);
  res.json(result);
});

exports.getCompanyStats = asyncHandler(async (req, res) => {
  const stats = await recruitmentService.getCompanyStats(req.user);
  res.json(stats);
});

exports.updateCircular = asyncHandler(async (req, res) => {
  const circular = await recruitmentService.updateCircular(req.user, req.params.id, req.body);
  res.json(circular);
});

exports.deleteCircular = asyncHandler(async (req, res) => {
  const result = await recruitmentService.deleteCircular(req.user, req.params.id);
  res.json(result);
});
