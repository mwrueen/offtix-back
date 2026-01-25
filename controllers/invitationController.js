const Invitation = require('../models/Invitation');
const Notification = require('../models/Notification');
const Company = require('../models/Company');
const User = require('../models/User');
const crypto = require('crypto');

// Send invitation to join company
exports.sendInvitation = async (req, res) => {
  try {
    const { email, designation, salary } = req.body;
    const companyId = req.params.companyId;

    // Validate inputs
    if (!email || !designation) {
      return res.status(400).json({ message: 'Email and designation are required' });
    }

    // Check if company exists
    const company = await Company.findById(companyId);
    if (!company) {
      return res.status(404).json({ message: 'Company not found' });
    }

    // Check if user has permission to invite
    const isOwner = company.owner.toString() === req.user._id.toString();
    const userMember = company.members.find(m => m.user.toString() === req.user._id.toString());
    const userDesignation = userMember ? company.designations.find(d => d.name === userMember.designation) : null;
    const canInvite = isOwner || (userDesignation && userDesignation.permissions.addEmployee);

    if (!canInvite) {
      return res.status(403).json({ message: 'You do not have permission to invite employees' });
    }

    // Check if designation exists
    const designationExists = company.designations.some(d => d.name === designation);
    if (!designationExists) {
      return res.status(400).json({ message: 'Designation does not exist in this company' });
    }

    // Check if user is already a member
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      const isMember = company.members.some(m => m.user.toString() === existingUser._id.toString());
      if (isMember) {
        return res.status(400).json({ message: 'User is already a member of this company' });
      }
    }

    // Check for existing pending invitation
    const existingInvitation = await Invitation.findOne({
      email: email.toLowerCase(),
      company: companyId,
      status: 'pending'
    });

    if (existingInvitation && !existingInvitation.isExpired()) {
      return res.status(400).json({ message: 'An invitation has already been sent to this email' });
    }

    // Generate unique token
    const token = crypto.randomBytes(32).toString('hex');

    // Create invitation (expires in 7 days)
    const invitation = new Invitation({
      email: email.toLowerCase(),
      company: companyId,
      designation,
      salary: salary || 0,
      invitedBy: req.user._id,
      token,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
    });

    await invitation.save();

    // If user exists, create notification
    if (existingUser) {
      const notification = new Notification({
        user: existingUser._id,
        type: 'invitation',
        title: 'Company Invitation',
        message: `You have been invited to join ${company.name} as ${designation}`,
        relatedId: invitation._id,
        relatedModel: 'Invitation'
      });
      await notification.save();
    }

    const populatedInvitation = await Invitation.findById(invitation._id)
      .populate('company', 'name')
      .populate('invitedBy', 'name email');

    res.status(201).json({
      message: 'Invitation sent successfully',
      invitation: populatedInvitation
    });
  } catch (error) {
    console.error('Error sending invitation:', error);
    res.status(500).json({ message: error.message });
  }
};

// Get all invitations for a company
exports.getCompanyInvitations = async (req, res) => {
  try {
    const companyId = req.params.companyId;

    const invitations = await Invitation.find({ company: companyId })
      .populate('invitedBy', 'name email')
      .sort({ createdAt: -1 });

    res.json(invitations);
  } catch (error) {
    console.error('Error fetching invitations:', error);
    res.status(500).json({ message: error.message });
  }
};

// Get user's pending invitations
exports.getUserInvitations = async (req, res) => {
  try {
    if (!req.user || !req.user.email) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const userEmail = req.user.email.toLowerCase();

    const invitations = await Invitation.find({
      email: userEmail,
      status: 'pending'
    })
      .populate('company', 'name description')
      .populate('invitedBy', 'name email')
      .sort({ createdAt: -1 });

    // Filter out expired invitations
    const validInvitations = invitations.filter(inv => {
      try {
        return !inv.isExpired();
      } catch (error) {
        // If isExpired fails, check manually
        return inv.expiresAt && new Date(inv.expiresAt) > new Date();
      }
    });

    res.json(validInvitations);
  } catch (error) {
    console.error('Error fetching user invitations:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ message: error.message || 'Internal server error' });
  }
};

// Accept invitation
exports.acceptInvitation = async (req, res) => {
  try {
    const { invitationId } = req.params;

    const invitation = await Invitation.findById(invitationId)
      .populate('company');

    if (!invitation) {
      return res.status(404).json({ message: 'Invitation not found' });
    }

    // Check if invitation belongs to the user
    if (invitation.email !== req.user.email.toLowerCase()) {
      return res.status(403).json({ message: 'This invitation is not for you' });
    }

    // Check if invitation is still pending
    if (invitation.status !== 'pending') {
      return res.status(400).json({ message: 'This invitation has already been processed' });
    }

    // Check if invitation is expired
    if (invitation.isExpired()) {
      invitation.status = 'expired';
      await invitation.save();
      return res.status(400).json({ message: 'This invitation has expired' });
    }

    // Add user to company
    const company = await Company.findById(invitation.company._id);
    
    // Check if user is already a member
    const isMember = company.members.some(m => m.user.toString() === req.user._id.toString());
    if (isMember) {
      return res.status(400).json({ message: 'You are already a member of this company' });
    }

    company.members.push({
      user: req.user._id,
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

    // Update user's company
    await User.findByIdAndUpdate(req.user._id, { company: company._id });

    // Update invitation status
    invitation.status = 'accepted';
    invitation.acceptedAt = new Date();
    await invitation.save();

    // Mark notification as read
    await Notification.updateMany(
      { relatedId: invitation._id, user: req.user._id },
      { isRead: true, readAt: new Date() }
    );

    const populatedCompany = await Company.findById(company._id)
      .populate('owner', 'name email')
      .populate('members.user', 'name email');

    res.json({
      message: 'Invitation accepted successfully',
      company: populatedCompany
    });
  } catch (error) {
    console.error('Error accepting invitation:', error);
    res.status(500).json({ message: error.message });
  }
};

// Reject invitation
exports.rejectInvitation = async (req, res) => {
  try {
    const { invitationId } = req.params;

    const invitation = await Invitation.findById(invitationId);

    if (!invitation) {
      return res.status(404).json({ message: 'Invitation not found' });
    }

    // Check if invitation belongs to the user
    if (invitation.email !== req.user.email.toLowerCase()) {
      return res.status(403).json({ message: 'This invitation is not for you' });
    }

    // Check if invitation is still pending
    if (invitation.status !== 'pending') {
      return res.status(400).json({ message: 'This invitation has already been processed' });
    }

    // Update invitation status
    invitation.status = 'rejected';
    invitation.rejectedAt = new Date();
    await invitation.save();

    // Mark notification as read
    await Notification.updateMany(
      { relatedId: invitation._id, user: req.user._id },
      { isRead: true, readAt: new Date() }
    );

    res.json({ message: 'Invitation rejected successfully' });
  } catch (error) {
    console.error('Error rejecting invitation:', error);
    res.status(500).json({ message: error.message });
  }
};

// Cancel invitation (by inviter)
exports.cancelInvitation = async (req, res) => {
  try {
    const { invitationId } = req.params;

    const invitation = await Invitation.findById(invitationId)
      .populate('company');

    if (!invitation) {
      return res.status(404).json({ message: 'Invitation not found' });
    }

    // Check if user has permission to cancel
    const company = invitation.company;
    const isOwner = company.owner.toString() === req.user._id.toString();
    const isInviter = invitation.invitedBy.toString() === req.user._id.toString();

    if (!isOwner && !isInviter) {
      return res.status(403).json({ message: 'You do not have permission to cancel this invitation' });
    }

    // Delete invitation
    await Invitation.findByIdAndDelete(invitationId);

    res.json({ message: 'Invitation cancelled successfully' });
  } catch (error) {
    console.error('Error cancelling invitation:', error);
    res.status(500).json({ message: error.message });
  }
};

