const express = require('express');
const router = express.Router();
const projectController = require('../controllers/projectController');
const { authenticate } = require('../middleware/auth');
const { validateProject } = require('../middleware/validation');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure multer for project file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../uploads/project-files');

    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'project-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

router.use(authenticate);

router.get('/', projectController.getProjects);
router.post('/', validateProject, projectController.createProject);
router.get('/:id', projectController.getProjectById);
router.put('/:id', validateProject, projectController.updateProject);
router.delete('/:id', projectController.deleteProject);

// Team member management routes
router.post('/:id/members', projectController.addTeamMember);
router.delete('/:id/members/:userId', projectController.removeTeamMember);

// Analytics route
router.get('/:id/analytics', projectController.getProjectAnalytics);

// File attachment routes
router.post('/:id/attachments', upload.single('file'), projectController.uploadAttachment);
router.delete('/:id/attachments/:attachmentId', projectController.deleteAttachment);

// Milestone management routes
router.post('/:id/milestones', projectController.addMilestone);
router.put('/:id/milestones/:milestoneId', projectController.updateMilestone);
router.delete('/:id/milestones/:milestoneId', projectController.deleteMilestone);

// Risk management routes
router.post('/:id/risks', projectController.addRisk);
router.put('/:id/risks/:riskId', projectController.updateRisk);
router.delete('/:id/risks/:riskId', projectController.deleteRisk);

// Dependency management routes
router.post('/:id/dependencies', projectController.addDependency);
router.put('/:id/dependencies/:dependencyId', projectController.updateDependency);
router.delete('/:id/dependencies/:dependencyId', projectController.deleteDependency);

// Tag management routes
router.post('/:id/tags', projectController.addTags);
router.delete('/:id/tags/:tag', projectController.removeTag);

// Settings management routes
router.put('/:id/settings', projectController.updateProjectSettings);
router.post('/:id/holidays', projectController.addHoliday);
router.delete('/:id/holidays/:holidayId', projectController.removeHoliday);

// Project status management
router.put('/:id/status', projectController.updateProjectStatus);

// Project cost breakdown
router.get('/:id/costs', projectController.getProjectCosts);

module.exports = router;