const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const taskRoleController = require('../controllers/taskRoleController');

// All routes require authentication
router.use(authenticate);

// Get all workflow roles for a project
router.get('/project/:projectId', taskRoleController.getProjectRoles);

// Create a new workflow role
router.post('/project/:projectId', taskRoleController.createRole);

// Initialize default workflow roles for a project
router.post('/project/:projectId/initialize', taskRoleController.initializeDefaultRoles);

// Reorder workflow roles
router.put('/project/:projectId/reorder', taskRoleController.reorderRoles);

// Update a workflow role
router.put('/project/:projectId/:roleId', taskRoleController.updateRole);

// Delete a workflow role
router.delete('/project/:projectId/:roleId', taskRoleController.deleteRole);

module.exports = router;

