const Stripe = require('stripe');
const User = require('../models/User');
const Company = require('../models/Company');
const SubscriptionPlan = require('../models/SubscriptionPlan');

const stripeSecretKey = process.env.STRIPE_SECRET_KEY || '';
const stripe = new Stripe(stripeSecretKey);

// Helper: Ensure default plan exists in database
const getOrCreateDefaultPlan = async () => {
  let plan = await SubscriptionPlan.findOne();
  if (!plan) {
    plan = await SubscriptionPlan.create({
      name: 'Premium Plan',
      monthlyPrice: 10,
      currency: 'usd',
      premiumFeatures: {
        allowAI: true,
        allowProjectFiles: true,
        allowChatDocs: true,
        allowTaskCompletionDocs: true
      },
      freeRestrictions: {
        allowAI: false,
        allowProjectFiles: false,
        allowChatDocs: false,
        allowTaskCompletionDocs: false
      }
    });
  } else {
    // Ensure freeRestrictions defaults to false for restricted features
    if (!plan.freeRestrictions) {
      plan.freeRestrictions = {
        allowAI: false,
        allowProjectFiles: false,
        allowChatDocs: false,
        allowTaskCompletionDocs: false
      };
      await plan.save();
    }
  }
  return plan;
};


// Create Stripe Checkout Session
exports.createCheckoutSession = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const planConfig = await getOrCreateDefaultPlan();
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: planConfig.currency || 'usd',
            product_data: {
              name: 'Offtix Premium Subscription',
              description: 'System-wide AI features, project file uploads, chat document sending, and task completion file attachments.',
            },
            unit_amount: Math.round(planConfig.monthlyPrice * 100),
            recurring: {
              interval: 'month'
            }
          },
          quantity: 1,
        },
      ],
      mode: 'subscription',
      customer_email: user.email,
      metadata: {
        userId: user._id.toString(),
        companyId: user.company ? user.company.toString() : ''
      },
      success_url: `${clientUrl}/pricing?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${clientUrl}/pricing?canceled=true`,
    });

    res.json({ url: session.url, sessionId: session.id });
  } catch (error) {
    console.error('Stripe Checkout Error:', error);
    res.status(500).json({ error: error.message || 'Failed to create checkout session' });
  }
};

// Verify session completion directly (fallback for local dev without webhook listener)
exports.verifySession = async (req, res) => {
  try {
    const { sessionId } = req.body;
    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID is required' });
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status === 'paid' || session.status === 'complete') {
      const userId = session.metadata?.userId || req.user?._id;
      if (userId) {
        await User.findByIdAndUpdate(userId, {
          'subscription.plan': 'premium',
          'subscription.status': 'active',
          'subscription.stripeCustomerId': session.customer || '',
          'subscription.stripeSubscriptionId': session.subscription || ''
        });

        if (session.metadata?.companyId) {
          await Company.findByIdAndUpdate(session.metadata.companyId, {
            'subscription.plan': 'premium',
            'subscription.status': 'active',
            'subscription.stripeCustomerId': session.customer || '',
            'subscription.stripeSubscriptionId': session.subscription || ''
          });
        }
      }
      return res.json({ success: true, message: 'Subscription activated successfully!' });
    }

    res.json({ success: false, status: session.payment_status });
  } catch (error) {
    console.error('Session Verification Error:', error);
    res.status(500).json({ error: error.message });
  }
};

// Handle Stripe Webhook Events
exports.handleWebhook = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;
  try {
    if (webhookSecret && sig) {
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } else {
      event = req.body;
    }
  } catch (err) {
    console.error(`Webhook Signature Error: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const userId = session.metadata?.userId;
        const companyId = session.metadata?.companyId;

        if (userId) {
          await User.findByIdAndUpdate(userId, {
            'subscription.plan': 'premium',
            'subscription.status': 'active',
            'subscription.stripeCustomerId': session.customer || '',
            'subscription.stripeSubscriptionId': session.subscription || ''
          });
        }
        if (companyId) {
          await Company.findByIdAndUpdate(companyId, {
            'subscription.plan': 'premium',
            'subscription.status': 'active',
            'subscription.stripeCustomerId': session.customer || '',
            'subscription.stripeSubscriptionId': session.subscription || ''
          });
        }
        break;
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        await User.updateMany({ 'subscription.stripeSubscriptionId': sub.id }, {
          'subscription.plan': 'free',
          'subscription.status': 'canceled'
        });
        await Company.updateMany({ 'subscription.stripeSubscriptionId': sub.id }, {
          'subscription.plan': 'free',
          'subscription.status': 'canceled'
        });
        break;
      }
      default:
        break;
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Webhook Handler Error:', error);
    res.status(500).json({ error: error.message });
  }
};

// Get current user / company subscription status & permissions
exports.getSubscriptionStatus = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const user = await User.findById(userId).populate('company');
    const planConfig = await getOrCreateDefaultPlan();

    let userPlan = user.subscription?.plan || 'free';
    let companyPlan = user.company?.subscription?.plan || 'free';

    // SuperAdmin accounts always get full premium access
    if (user.role === 'superadmin') {
      userPlan = 'premium';
    }

    const isPremium = userPlan === 'premium' || companyPlan === 'premium';
    const activePlanName = isPremium ? 'premium' : 'free';

    const permissions = isPremium
      ? (planConfig.premiumFeatures || {
          allowAI: true,
          allowProjectFiles: true,
          allowChatDocs: true,
          allowTaskCompletionDocs: true
        })
      : (planConfig.freeRestrictions || {
          allowAI: false,
          allowProjectFiles: false,
          allowChatDocs: false,
          allowTaskCompletionDocs: false
        });

    res.json({
      plan: activePlanName,
      isPremium,
      status: user.subscription?.status || user.company?.subscription?.status || 'none',
      monthlyPrice: planConfig.monthlyPrice,
      currency: planConfig.currency,
      permissions
    });
  } catch (error) {
    console.error('Get Subscription Status Error:', error);
    res.status(500).json({ error: error.message });
  }
};

// Get public plan config
exports.getPlanConfig = async (req, res) => {
  try {
    const plan = await getOrCreateDefaultPlan();
    res.json(plan);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// SuperAdmin: Update plan pricing and features
exports.updatePlanConfig = async (req, res) => {
  try {
    const { name, monthlyPrice, currency, description, premiumFeatures, freeRestrictions } = req.body;

    let plan = await SubscriptionPlan.findOne();
    if (!plan) {
      plan = new SubscriptionPlan();
    }

    if (name !== undefined) plan.name = name;
    if (monthlyPrice !== undefined) plan.monthlyPrice = Number(monthlyPrice);
    if (currency !== undefined) plan.currency = currency;
    if (description !== undefined) plan.description = description;
    if (premiumFeatures !== undefined) plan.premiumFeatures = { ...plan.premiumFeatures, ...premiumFeatures };
    if (freeRestrictions !== undefined) plan.freeRestrictions = { ...plan.freeRestrictions, ...freeRestrictions };
    plan.updatedBy = req.user._id;

    await plan.save();
    res.json({ success: true, message: 'Subscription plan updated successfully', plan });
  } catch (error) {
    console.error('Update Plan Config Error:', error);
    res.status(500).json({ error: error.message });
  }
};

// SuperAdmin: Manually set a user or company plan (override for testing / manual grants)
exports.manualSetUserPlan = async (req, res) => {
  try {
    const { targetUserId, plan } = req.body;
    if (!['free', 'premium'].includes(plan)) {
      return res.status(400).json({ error: 'Invalid plan type' });
    }

    const user = await User.findById(targetUserId);
    if (!user) {
      return res.status(404).json({ error: 'Target user not found' });
    }

    user.subscription.plan = plan;
    user.subscription.status = plan === 'premium' ? 'active' : 'none';
    await user.save();

    res.json({ success: true, message: `User plan updated to ${plan}` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// SuperAdmin: Get list of all users and their subscription status (highlighting Premium users)
exports.getSubscribers = async (req, res) => {
  try {
    const users = await User.find({}, '-password')
      .populate('company', 'name logo')
      .sort({ 'subscription.plan': -1, createdAt: -1 });

    const subscribers = users.map(user => {
      const isSuperAdmin = user.role === 'superadmin';
      const userPlan = user.subscription?.plan || (isSuperAdmin ? 'premium' : 'free');
      const companyPlan = user.company?.subscription?.plan || 'free';
      const isPremium = userPlan === 'premium' || companyPlan === 'premium' || isSuperAdmin;

      return {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
        company: user.company ? { _id: user.company._id, name: user.company.name } : null,
        plan: isPremium ? 'premium' : 'free',
        status: user.subscription?.status || (isSuperAdmin ? 'active' : (isPremium ? 'active' : 'free')),
        stripeCustomerId: user.subscription?.stripeCustomerId || '',
        stripeSubscriptionId: user.subscription?.stripeSubscriptionId || '',
        isPremium,
        createdAt: user.createdAt
      };
    });



    res.json({
      totalUsers: subscribers.length,
      premiumCount: subscribers.filter(s => s.isPremium).length,
      freeCount: subscribers.filter(s => !s.isPremium).length,
      subscribers
    });
  } catch (error) {
    console.error('Get Subscribers Error:', error);
    res.status(500).json({ error: error.message });
  }
};
