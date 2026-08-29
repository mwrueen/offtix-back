const User = require('../models/User');
const SubscriptionPlan = require('../models/SubscriptionPlan');

const requirePremium = (featureKey) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // SuperAdmin accounts bypass all restrictions
      if (req.user.role === 'superadmin') {
        return next();
      }

      const user = await User.findById(req.user._id || req.user.id).populate('company');
      if (!user) {
        return res.status(401).json({ error: 'User account not found' });
      }

      const userPlan = user.subscription?.plan || 'free';
      const companyPlan = user.company?.subscription?.plan || 'free';
      const isPremium = userPlan === 'premium' || companyPlan === 'premium';

      if (isPremium) {
        return next();
      }

      // Load plan config for dynamic feature permissions
      let planConfig = await SubscriptionPlan.findOne();
      if (!planConfig) {
        planConfig = {
          freeRestrictions: {
            allowAI: false,
            allowProjectFiles: false,
            allowChatDocs: false,
            allowTaskCompletionDocs: false
          }
        };
      }

      const freeAllowed = planConfig.freeRestrictions?.[featureKey] || false;

      if (!freeAllowed) {
        return res.status(403).json({
          error: 'PREMIUM_FEATURE_RESTRICTED',
          feature: featureKey,
          message: `Free account restriction: Premium subscription ($10/mo) required to access ${featureKey}. Please upgrade.`
        });
      }

      next();
    } catch (error) {
      console.error('requirePremium Middleware Error:', error);
      res.status(500).json({ error: 'Failed to verify subscription status' });
    }
  };
};

// Middleware specifically for requests where document/file attachment is optional (e.g. task completion with files)
const requirePremiumIfFiles = (featureKey) => {
  return async (req, res, next) => {
    try {
      const hasFiles = (req.files && req.files.length > 0) || req.file || (req.body && req.body.attachment);
      if (!hasFiles) {
        return next();
      }
      return requirePremium(featureKey)(req, res, next);
    } catch (error) {
      console.error('requirePremiumIfFiles Error:', error);
      res.status(500).json({ error: 'Failed to verify file attachment subscription status' });
    }
  };
};

module.exports = requirePremium;
module.exports.requirePremiumIfFiles = requirePremiumIfFiles;
