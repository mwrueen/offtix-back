const express = require('express');
const router = express.Router({ mergeParams: true });
const phaseController = require('../controllers/phaseController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get('/', phaseController.getPhases);
router.post('/', phaseController.createPhase);

module.exports = router;