const express = require('express');
const router = express.Router();
const projectController = require('../controllers/projectController');
const { authenticate } = require('../middleware/auth');
const { validateProject } = require('../middleware/validation');
const { requirePermission } = require('../middleware/permissions');
const createUploader = require('../utils/uploadHelper');

// Configure multer for project file uploads
const upload = createUploader({
  destination: 'uploads/project-files',
  prefix: 'project',
  limitSize: 10 * 1024 * 1024 // 10MB limit
});

// Configure multer for project logos
const logoUpload = createUploader({
  destination: 'uploads/project-logos',
  prefix: 'logo',
  limitSize: 2 * 1024 * 1024, // 2MB limit for logos
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed for logos'), false);
    }
  }
});

router.use(authenticate);

router.get('/', projectController.getProjects);
router.post('/', logoUpload.single('logo'), requirePermission('createProject'), validateProject, projectController.createProject);
router.get('/:id', projectController.getProjectById);
router.put('/:id', logoUpload.single('logo'), projectController.updateProject);
router.delete('/:id', projectController.deleteProject);

// Team member management routes
router.post('/:id/members', requirePermission('assignEmployeeToProject'), projectController.addTeamMember);
router.delete('/:id/members/:userId', requirePermission('removeEmployeeFromProject'), projectController.removeTeamMember);

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