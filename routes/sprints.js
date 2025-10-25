const express = require('express');
const router = express.Router({ mergeParams: true });
const sprintController = require('../controllers/sprintController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get('/', sprintController.getSprints);
router.post('/', sprintController.createSprint);

module.exports = router;