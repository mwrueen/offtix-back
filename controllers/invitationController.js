const asyncHandler = require('../utils/asyncHandler');
const invitationService = require('../services/invitationService');

exports.sendInvitation = asyncHandler(async (req, res) => {
  const result = await invitationService.sendInvitation(req.params.companyId, req.user._id, req.body);
  res.status(201).json(result);
});

exports.getCompanyInvitations = asyncHandler(async (req, res) => {
  const invitations = await invitationService.getCompanyInvitations(req.params.companyId);
  res.json(invitations);
});

exports.getInvitationDetails = asyncHandler(async (req, res) => {
  const invitation = await invitationService.getInvitationDetails(req.params.invitationId, req.user.email);
  res.json(invitation);
});

exports.getUserInvitations = asyncHandler(async (req, res) => {
  const companyId = req.headers['x-company-id'] || req.query.companyId || null;
  const invitations = await invitationService.getUserInvitations(req.user.email, companyId);
  res.json(invitations);
});

exports.acceptInvitation = asyncHandler(async (req, res) => {
  const result = await invitationService.acceptInvitation(req.params.invitationId, req.user._id, req.user.email);
  res.json(result);
});

exports.rejectInvitation = asyncHandler(async (req, res) => {
  const result = await invitationService.rejectInvitation(req.params.invitationId, req.user._id, req.user.email);
  res.json(result);
});

exports.cancelInvitation = asyncHandler(async (req, res) => {
  const result = await invitationService.cancelInvitation(req.params.invitationId, req.user._id);
  res.json(result);
});

