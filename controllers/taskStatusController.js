const asyncHandler = require('../utils/asyncHandler');
const taskStatusService = require('../services/taskStatusService');

exports.getTaskStatuses = asyncHandler(async (req, res) => {
  const statuses = await taskStatusService.getTaskStatuses(req.params.projectId, req.user._id);
  res.json(statuses);
});

exports.createTaskStatus = asyncHandler(async (req, res) => {
  const status = await taskStatusService.createTaskStatus(req.params.projectId, req.user._id, req.body);
  res.status(201).json(status);
});

exports.updateTaskStatus = asyncHandler(async (req, res) => {
  const status = await taskStatusService.updateTaskStatus(
    req.params.projectId,
    req.params.statusId,
    req.user._id,
    req.body
  );
  res.json(status);
});

exports.deleteTaskStatus = asyncHandler(async (req, res) => {
  const result = await taskStatusService.deleteTaskStatus(
    req.params.projectId,
    req.params.statusId,
    req.user._id
  );
  res.json(result);
});