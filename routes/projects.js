const express = require('express');
const router = express.Router();
const projectController = require('../controllers/projectController');
const { authenticate } = require('../middleware/auth');
const { validateProject } = require('../middleware/validation');

router.use(authenticate);

router.get('/', projectController.getProjects);
router.post('/', validateProject, projectController.createProject);
router.get('/:id', projectController.getProjectById);
router.put('/:id', validateProject, projectController.updateProject);
router.delete('/:id', projectController.deleteProject);

// Team member management routes
router.post('/:id/members', projectController.addTeamMember);
router.delete('/:id/members/:userId', projectController.removeTeamMember);

module.exports = router;