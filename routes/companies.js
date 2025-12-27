const express = require('express');
const router = express.Router();
const companyController = require('../controllers/companyController');
const { authenticate } = require('../middleware/auth');

router.post('/', authenticate, companyController.createCompany);
router.get('/my-company', authenticate, companyController.getUserCompany);
router.get('/user-companies', authenticate, companyController.getUserCompanies);
router.get('/:id', authenticate, companyController.getCompany);
router.put('/:id/profile', authenticate, companyController.updateCompanyProfile);
router.post('/:id/add-member', authenticate, companyController.addMember);
router.put('/:id/update-salary', authenticate, companyController.updateMemberSalary);
router.put('/:id/update-designation', authenticate, companyController.updateMemberDesignation);
router.post('/:id/designations', authenticate, companyController.addDesignation);
router.put('/:id/designation-permissions', authenticate, companyController.updateDesignationPermissions);
router.delete('/:id/designations/:designationId', authenticate, companyController.deleteDesignation);

// Company Settings Routes
router.put('/:id/settings', authenticate, companyController.updateCompanySettings);
router.post('/:id/holidays', authenticate, companyController.addHoliday);
router.delete('/:id/holidays/:holidayId', authenticate, companyController.removeHoliday);

// Workforce Route - Get employees with their tasks
router.get('/:id/workforce', authenticate, companyController.getWorkforce);

// Organization Hierarchy Routes
router.get('/:id/organogram', authenticate, companyController.getOrganogram);
router.put('/:id/reporting-manager', authenticate, companyController.updateReportingManager);
router.put('/:id/designation-level', authenticate, companyController.updateDesignationLevel);

module.exports = router;