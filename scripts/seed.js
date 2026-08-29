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
    console.log('✅ Connected to MongoDB:', mongoUri);
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
};

const ensureDemoAccounts = async () => {
  console.log('👤 Ensuring required demo accounts exist...');
  const demoAccounts = [
    {
      name: 'Super Admin',
      email: 'admin@offtix.com',
      password: 'password123',
      role: 'superadmin'
    },
    {
      name: 'Client Admin',
      email: 'client@offtix.com',
      password: 'password123',
      role: 'admin'
    },
    {
      name: 'Standard User',
      email: 'user@offtix.com',
      password: 'password123',
      role: 'user'
    }
  ];

  for (const acc of demoAccounts) {
    const existing = await User.findOne({ email: acc.email });
    if (!existing) {
      await User.create(acc);
      console.log(`   + Created: ${acc.email} (${acc.role})`);
    } else {
      existing.password = acc.password;
      existing.role = acc.role;
      await existing.save();
      console.log(`   ~ Updated password for: ${acc.email}`);
    }
  }
};

const seed = async () => {
  const clean = process.argv.includes('--clean');
  try {
    await connectDB();

    if (clean) {
      console.log('🧹 Cleaning existing demo company data...');
      await cleanCompanyData();
    }

    console.log('🌱 Seeding default system data (currencies, admin roles)...');
    await createDefaultData();

    console.log('🌱 Ensuring demo accounts...');
    await ensureDemoAccounts();

    console.log('🌱 Generating company, projects, and task tickets...');
    await generateCompanyData();

    console.log('🎉 Database seeding completed successfully!');
    console.log('--------------------------------------------------');
    console.log('Demo Credentials:');
    console.log('  Super Admin : admin@offtix.com  / password123');
    console.log('  Client Admin: client@offtix.com / password123');
    console.log('  Standard User: user@offtix.com  / password123');
    console.log('--------------------------------------------------');
    process.exit(0);
  } catch (error) {
    console.error('❌ Database seeding failed:', error);
    process.exit(1);
  }
};

seed();
