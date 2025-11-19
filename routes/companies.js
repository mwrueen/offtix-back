const express = require('express');
const router = express.Router();
const companyController = require('../controllers/companyController');
const { authenticate } = require('../middleware/auth');

router.post('/', authenticate, companyController.createCompany);
router.get('/my-company', authenticate, companyController.getUserCompany);
router.get('/user-companies', authenticate, companyController.getUserCompanies);
router.get('/:id', authenticate, companyController.getCompany);
router.post('/:id/add-member', authenticate, companyController.addMember);
router.put('/:id/update-salary', authenticate, companyController.updateMemberSalary);
router.put('/:id/update-designation', authenticate, companyController.updateMemberDesignation);
router.post('/:id/designations', authenticate, companyController.addDesignation);
router.put('/:id/designation-permissions', authenticate, companyController.updateDesignationPermissions);

// Company Settings Routes
router.put('/:id/settings', authenticate, companyController.updateCompanySettings);
router.post('/:id/holidays', authenticate, companyController.addHoliday);
router.delete('/:id/holidays/:holidayId', authenticate, companyController.removeHoliday);

module.exports = router;