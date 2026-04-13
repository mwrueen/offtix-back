const Invitation = require('../models/Invitation');
const Notification = require('../models/Notification');
const emitSocketNotification = require('./emitSocketNotification');

/**
 * For each pending company invitation addressed to this user's email, ensure a
 * Notification row exists and push `notification:new` over Socket.IO.
 * Covers invites sent before the user registered (previously no DB row / no emit).
 */
async function syncPendingInvitationNotifications(user) {
  if (!user || !user.email) return;

  const email = String(user.email).toLowerCase();
  const invitations = await Invitation.find({
    email,
    status: 'pending',
    expiresAt: { $gt: new Date() }
  }).populate('company', 'name');

  for (const inv of invitations) {
    const exists = await Notification.findOne({
      user: user._id,
      relatedId: inv._id,
      type: 'invitation'
    });
    if (exists) continue;

    const companyName = inv.company?.name || 'a company';
    const notification = new Notification({
      user: user._id,
      company: inv.company?._id || inv.company,
      type: 'invitation',
      title: 'Company Invitation',
      message: `You have been invited to join ${companyName} as ${inv.designation}`,
      relatedId: inv._id,
      relatedModel: 'Invitation'
    });
    await notification.save();
    emitSocketNotification(null, user._id, notification);
  }
}

module.exports = syncPendingInvitationNotifications;
