const express = require('express');
const router = express.Router({ mergeParams: true });
const requirementController = require('../controllers/requirementController');
const { authenticate } = require('../middleware/auth');
const createUploader = require('../utils/uploadHelper');

// Configure multer for requirement file uploads
const upload = createUploader({
  destination: 'uploads/requirement-files',
  prefix: 'req',
  limitSize: 10 * 1024 * 1024 // 10MB limit
});

router.use(authenticate);

router.get('/', requirementController.getRequirements);
router.post('/', requirementController.createRequirement);
router.put('/:requirementId', requirementController.updateRequirement);
router.delete('/:requirementId', requirementController.deleteRequirement);
router.post('/:requirementId/comments', requirementController.addComment);

// File attachment routes
router.post('/:requirementId/attachments', upload.single('file'), requirementController.uploadAttachment);
router.delete('/:requirementId/attachments/:attachmentId', requirementController.deleteAttachment);

// Convert to task
router.post('/:requirementId/convert-to-task', requirementController.convertToTask);

module.exports = router;