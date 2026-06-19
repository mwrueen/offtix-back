const asyncHandler = require('../utils/asyncHandler');
const phaseService = require('../services/phaseService');

exports.getPhases = asyncHandler(async (req, res) => {
  const phases = await phaseService.getPhases(req.params.projectId, req.user._id);
  res.json(phases);
});

exports.createPhase = asyncHandler(async (req, res) => {
  const phase = await phaseService.createPhase(req.params.projectId, req.user._id, req.body);
  res.status(201).json(phase);
});