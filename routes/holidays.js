const express = require('express');
const router = express.Router({ mergeParams: true });
const holidayController = require('../controllers/holidayController');
const { authenticate } = require('../middleware/auth');

// All routes require authentication
router.use(authenticate);

// Get all holidays for a company
router.get('/', holidayController.getCompanyHolidays);

// Get upcoming holidays
router.get('/upcoming', holidayController.getUpcomingHolidays);

// Add a holiday
router.post('/', holidayController.addHoliday);

// Update a holiday
router.put('/:holidayId', holidayController.updateHoliday);

// Delete a holiday
router.delete('/:holidayId', holidayController.deleteHoliday);

module.exports = router;

