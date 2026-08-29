const mongoose = require('mongoose');
const { createDefaultData } = require('../config/defaultData');
const { generateCompanyData, cleanCompanyData } = require('../config/companyDataGenerator');
const User = require('../models/User');
require('dotenv').config();

const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/offtix';
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log(`[${new Date().toISOString()}] 🔄 Connected to MongoDB for Demo Reset.`);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] ❌ DB Connection Error:`, error);
    process.exit(1);
  }
};

const resetDemo = async () => {
  try {
    await connectDB();

    console.log(`[${new Date().toISOString()}] 🧹 Resetting demo database...`);
    await cleanCompanyData();

    await createDefaultData();

    // Ensure demo accounts
    const demoAccounts = [
      { name: 'Super Admin', email: 'admin@offtix.com', password: 'password123', role: 'superadmin' },
      { name: 'Client Admin', email: 'client@offtix.com', password: 'password123', role: 'admin' },
      { name: 'Standard User', email: 'user@offtix.com', password: 'password123', role: 'user' }
    ];

    for (const acc of demoAccounts) {
      let existing = await User.findOne({ email: acc.email });
      if (!existing) {
        await User.create(acc);
      } else {
        existing.password = acc.password;
        existing.role = acc.role;
        await existing.save();
      }
    }

    await generateCompanyData();

    console.log(`[${new Date().toISOString()}] ✅ Demo database reset successfully!`);
    process.exit(0);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] ❌ Demo Reset Error:`, error);
    process.exit(1);
  }
};

resetDemo();
