const express = require('express');
const router = express.Router({ mergeParams: true });
const requirementController = require('../controllers/requirementController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get('/', requirementController.getRequirements);
router.post('/', requirementController.createRequirement);
router.put('/:requirementId', requirementController.updateRequirement);
router.delete('/:requirementId', requirementController.deleteRequirement);
router.post('/:requirementId/comments', requirementController.addComment);

module.exports = router;