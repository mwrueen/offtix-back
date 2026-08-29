const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const subscriptionController = require('../controllers/subscriptionController');

// Public route to get plan config (pricing & feature toggles)
router.get('/plan-config', subscriptionController.getPlanConfig);

// Protected user routes
router.get('/status', authenticate, subscriptionController.getSubscriptionStatus);
router.post('/create-checkout-session', authenticate, subscriptionController.createCheckoutSession);
router.post('/verify-session', authenticate, subscriptionController.verifySession);

// Webhook route (Stripe calls this)
router.post('/webhook', express.raw({ type: 'application/json' }), subscriptionController.handleWebhook);

// SuperAdmin management routes
router.put('/plan-config', authenticate, (req, res, next) => {
  if (req.user.role !== 'superadmin' && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'SuperAdmin access required' });
  }
  next();
}, subscriptionController.updatePlanConfig);

router.post('/manual-set-user-plan', authenticate, (req, res, next) => {
  if (req.user.role !== 'superadmin') {
    return res.status(403).json({ error: 'SuperAdmin access required' });
  }
  next();
}, subscriptionController.manualSetUserPlan);

router.get('/subscribers', authenticate, (req, res, next) => {
  if (req.user.role !== 'superadmin' && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'SuperAdmin access required' });
  }
  next();
}, subscriptionController.getSubscribers);

module.exports = router;
