const express = require('express');
const router = express.Router();
const skillController = require('../controllers/skillController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get('/', skillController.getSkills);
router.post('/', skillController.createSkill);
router.post('/bulk', skillController.ensureSkills);

module.exports = router;
