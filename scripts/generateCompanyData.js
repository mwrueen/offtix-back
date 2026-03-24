const mongoose = require('mongoose');
const { generateCompanyData, cleanCompanyData } = require('../config/companyDataGenerator');
require('dotenv').config();

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/offtix', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
};

const main = async () => {
  const clean = process.argv.includes('--clean');

  try {
    await connectDB();

    if (clean) {
      console.log('🧹 --clean flag detected. Removing existing company data...');
      await cleanCompanyData();
    }

    await generateCompanyData();
    console.log('🎉 Data generation completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

main();