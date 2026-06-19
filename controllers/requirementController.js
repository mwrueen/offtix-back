const asyncHandler = require('../utils/asyncHandler');
const requirementService = require('../services/requirementService');

exports.getRequirements = asyncHandler(async (req, res) => {
  const requirements = await requirementService.getRequirements(req.params.projectId, req.user._id);
  res.json(requirements);
});

exports.createRequirement = asyncHandler(async (req, res) => {
  const requirement = await requirementService.createRequirement(req.params.projectId, req.user._id, req.body);
  res.status(201).json(requirement);
});

exports.updateRequirement = asyncHandler(async (req, res) => {
  const requirement = await requirementService.updateRequirement(
    req.params.projectId,
    req.params.requirementId,
    req.user._id,
    req.body
  );
  res.json(requirement);
});

exports.deleteRequirement = asyncHandler(async (req, res) => {
  const result = await requirementService.deleteRequirement(req.params.projectId, req.params.requirementId, req.user._id);
  res.json(result);
});

exports.convertToTask = asyncHandler(async (req, res) => {
  const result = await requirementService.convertToTask(req.params.projectId, req.params.requirementId, req.user._id);
  res.status(201).json(result);
});

exports.addComment = asyncHandler(async (req, res) => {
  const requirement = await requirementService.addComment(
    req.params.projectId,
    req.params.requirementId,
    req.user._id,
    req.body.content
  );
  res.json(requirement);
});

exports.uploadAttachment = asyncHandler(async (req, res) => {
  const result = await requirementService.uploadAttachment(
    req.params.projectId,
    req.params.requirementId,
    req.user._id,
    req.file
  );
  res.json(result);
});

exports.deleteAttachment = asyncHandler(async (req, res) => {
  const result = await requirementService.deleteAttachment(
    req.params.projectId,
    req.params.requirementId,
    req.params.attachmentId,
    req.user._id
  );
  res.json(result);
});