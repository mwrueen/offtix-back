const Invitation = require('../models/Invitation');
const Notification = require('../models/Notification');
const Company = require('../models/Company');
const User = require('../models/User');
const crypto = require('crypto');
const emitSocketNotification = require('../utils/emitSocketNotification');
const ApiError = require('../utils/ApiError');

const INVITATION_TTL = 7 * 24 * 60 * 60 * 1000;

const requireInvitePermission = async (companyId, userId) => {
  const company = await Company.findById(companyId);
  if (!company) throw ApiError.notFound('Company not found');
  const isOwner = company.owner.toString() === userId.toString();
  const member = company.members.find((m) => m.user.toString() === userId.toString());
  const designation = member ? company.designations.find((d) => d.name === member.designation) : null;
  if (!isOwner && !(designation && designation.permissions.addEmployee)) {
    throw ApiError.forbidden('You do not have permission to invite employees');
  }
  return company;
};

const sendInvitation = async (companyId, userId, body) => {
  const { email, designation, salary, jobDescription = '', facilities = '', termsAndPolicies = '' } = body;
  if (!email || !designation) throw ApiError.badRequest('Email and designation are required');
  const company = await requireInvitePermission(companyId, userId);
  const designationExists = company.designations.some((d) => d.name === designation);
  if (!designationExists) throw ApiError.badRequest('Designation does not exist in this company');

  const existingUser = await User.findOne({ email: email.toLowerCase() });
  if (existingUser) {
    const isMember = company.members.some((m) => m.user.toString() === existingUser._id.toString());
    if (isMember) throw ApiError.badRequest('User is already a member of this company');
  }

  const existingInvitation = await Invitation.findOne({
    email: email.toLowerCase(),
    company: companyId,
    status: 'pending'
  });
  if (existingInvitation && !existingInvitation.isExpired()) {
    throw ApiError.badRequest('An invitation has already been sent to this email');
  }

  const token = crypto.randomBytes(32).toString('hex');
  const invitation = new Invitation({
    email: email.toLowerCase(),
    company: companyId,
    designation,
    salary: salary || 0,
    jobDescription: String(jobDescription).trim().slice(0, 20000),
    facilities: String(facilities).trim().slice(0, 20000),
    termsAndPolicies: String(termsAndPolicies).trim().slice(0, 20000),
    invitedBy: userId,
    token,
    expiresAt: new Date(Date.now() + INVITATION_TTL)
  });
  await invitation.save();

  if (existingUser) {
    const notification = new Notification({
      user: existingUser._id,
      company: companyId,
      type: 'invitation',
      title: 'Company Invitation',
      message: `You have been invited to join ${company.name} as ${designation}`,
      relatedId: invitation._id,
      relatedModel: 'Invitation'
    });
    await notification.save();
    emitSocketNotification(null, existingUser._id, notification);
  }

  const populatedInvitation = await Invitation.findById(invitation._id)
    .populate('company', 'name')
    .populate('invitedBy', 'name email');
  return { message: 'Invitation sent successfully', invitation: populatedInvitation };
};

const getCompanyInvitations = async (companyId) =>
  Invitation.find({ company: companyId })
    .populate('invitedBy', 'name email')
    .sort({ createdAt: -1 });

const getInvitationDetails = async (invitationId, userEmail) => {
  const invitation = await Invitation.findById(invitationId)
    .populate('company', 'name description currency industry website logo email phone address city country')
    .populate('invitedBy', 'name email');
  if (!invitation) throw ApiError.notFound('Invitation not found');
  if (invitation.email !== userEmail.toLowerCase()) throw ApiError.forbidden('You do not have access to this invitation');
  return invitation;
};

const getUserInvitations = async (userEmail, companyId) => {
  const filter = { email: userEmail.toLowerCase(), status: 'pending' };
  if (companyId) filter.company = companyId;
  const invitations = await Invitation.find(filter)
    .populate('company', 'name description currency logo')
    .populate('invitedBy', 'name email')
    .sort({ createdAt: -1 });
  return invitations.filter((inv) => {
    try { return !inv.isExpired(); }
    catch { return inv.expiresAt && new Date(inv.expiresAt) > new Date(); }
  });
};

const acceptInvitation = async (invitationId, userId, userEmail) => {
  const invitation = await Invitation.findById(invitationId).populate('company');
  if (!invitation) throw ApiError.notFound('Invitation not found');
  if (invitation.email !== userEmail.toLowerCase()) throw ApiError.forbidden('This invitation is not for you');
  if (invitation.status !== 'pending') throw ApiError.badRequest('This invitation has already been processed');
  if (invitation.isExpired()) {
    invitation.status = 'expired';
    await invitation.save();
    throw ApiError.badRequest('This invitation has expired');
  }

  const company = await Company.findById(invitation.company._id);
  const isMember = company.members.some((m) => m.user.toString() === userId.toString());
  if (isMember) throw ApiError.badRequest('You are already a member of this company');

  company.members.push({
    user: userId,
    designation: invitation.designation,
    currentSalary: invitation.salary,
    salaryHistory: invitation.salary > 0 ? [{
      amount: invitation.salary,
      effectiveDate: new Date(),
      reason: 'Initial salary',
      updatedBy: invitation.invitedBy
    }] : []
  });
  await company.save();
  await User.findByIdAndUpdate(userId, { company: company._id });
  invitation.status = 'accepted';
  invitation.acceptedAt = new Date();
  await invitation.save();
  await Notification.updateMany(
    { relatedId: invitation._id, user: userId },
    { isRead: true, readAt: new Date() }
  );
  const populatedCompany = await Company.findById(company._id)
    .populate('owner', 'name email')
    .populate('members.user', 'name email');
  return { message: 'Invitation accepted successfully', company: populatedCompany };
};

const rejectInvitation = async (invitationId, userId, userEmail) => {
  const invitation = await Invitation.findById(invitationId);
  if (!invitation) throw ApiError.notFound('Invitation not found');
  if (invitation.email !== userEmail.toLowerCase()) throw ApiError.forbidden('This invitation is not for you');
  if (invitation.status !== 'pending') throw ApiError.badRequest('This invitation has already been processed');
  invitation.status = 'rejected';
  invitation.rejectedAt = new Date();
  await invitation.save();
  await Notification.updateMany(
    { relatedId: invitation._id, user: userId },
    { isRead: true, readAt: new Date() }
  );
  return { message: 'Invitation rejected successfully' };
};

const cancelInvitation = async (invitationId, userId) => {
  const invitation = await Invitation.findById(invitationId).populate('company');
  if (!invitation) throw ApiError.notFound('Invitation not found');
  const isOwner = invitation.company.owner.toString() === userId.toString();
  const isInviter = invitation.invitedBy.toString() === userId.toString();
  if (!isOwner && !isInviter) throw ApiError.forbidden('You do not have permission to cancel this invitation');
  await Invitation.findByIdAndDelete(invitationId);
  return { message: 'Invitation cancelled successfully' };
};

module.exports = {
  sendInvitation,
  getCompanyInvitations,
  getInvitationDetails,
  getUserInvitations,
  acceptInvitation,
  rejectInvitation,
  cancelInvitation
};
