const express = require('express');
const router = express.Router();
const invitationController = require('../controllers/invitationController');
const { authenticate } = require('../middleware/auth');

// All routes require authentication
router.use(authenticate);

// Send invitation to join company
router.post('/company/:companyId/invite', invitationController.sendInvitation);

// Get all invitations for a company
router.get('/company/:companyId', invitationController.getCompanyInvitations);

// Get user's pending invitations
router.get('/my-invitations', invitationController.getUserInvitations);

// Accept invitation
router.post('/:invitationId/accept', invitationController.acceptInvitation);

// Reject invitation
router.post('/:invitationId/reject', invitationController.rejectInvitation);

// Cancel invitation (by inviter)
router.delete('/:invitationId', invitationController.cancelInvitation);

module.exports = router;

