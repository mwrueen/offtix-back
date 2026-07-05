const express = require('express');
const router = express.Router();
const currencyController = require('../controllers/currencyController');
const { authenticate } = require('../middleware/auth');
const createUploader = require('../utils/uploadHelper');

// Configure multer for currency icon uploads
const upload = createUploader({
  destination: 'uploads/currency-icons',
  prefix: 'currency',
  limitSize: 2 * 1024 * 1024, // 2MB limit
  onlyImages: true
});

// Middleware to restrict access to superadmin role only
const requireSuperadmin = (req, res, next) => {
  if (req.user && req.user.role === 'superadmin') {
    next();
  } else {
    res.status(403).json({ error: 'Access denied. Superadmin role required.' });
  }
};

// GET: anyone authenticated can read the currencies list
router.get('/', authenticate, currencyController.getCurrencies);

// CRUD routes: Restricted to superadmin
router.post('/', authenticate, requireSuperadmin, currencyController.createCurrency);
router.put('/:id', authenticate, requireSuperadmin, currencyController.updateCurrency);
router.delete('/:id', authenticate, requireSuperadmin, currencyController.deleteCurrency);
router.post('/:id/icon', authenticate, requireSuperadmin, upload.single('icon'), currencyController.uploadIcon);

module.exports = router;
