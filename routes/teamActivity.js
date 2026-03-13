const express = require('express');
const router = express.Router();
const teamActivityController = require('../controllers/teamActivityController');
const { authenticate } = require('../middleware/auth');

// Apply authentication middleware
router.use(authenticate);

// Get team members and their current task activity
router.get('/', teamActivityController.getTeamActivity);

module.exports = router;
