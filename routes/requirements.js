const express = require('express');
const router = express.Router({ mergeParams: true });
const requirementController = require('../controllers/requirementController');
const { authenticate } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure multer for requirement file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../uploads/requirement-files');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'req-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
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

module.exports = router;