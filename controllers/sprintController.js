const asyncHandler = require('../utils/asyncHandler');
const sprintService = require('../services/sprintService');

exports.getSprints = asyncHandler(async (req, res) => {
  const sprints = await sprintService.getSprints(req.params.projectId, req.user._id);
  res.json(sprints);
});

exports.createSprint = asyncHandler(async (req, res) => {
  const sprint = await sprintService.createSprint(req.params.projectId, req.user._id, req.body);
  res.status(201).json(sprint);
});