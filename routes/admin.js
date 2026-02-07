const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { authenticate } = require('../middleware/auth');

// Get admin statistics (superadmin only)
router.get('/stats', authenticate, adminController.getStats);

// Get all companies (superadmin and admin)
router.get('/companies', authenticate, adminController.getAllCompanies);

// Get specific company details
router.get('/companies/:id', authenticate, adminController.getCompanyDetails);

// Get projects for a specific company
router.get('/companies/:id/projects', authenticate, adminController.getCompanyProjects);

module.exports = router;
