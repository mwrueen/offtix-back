const mongoose = require('mongoose');
const { createDefaultData } = require('./defaultData');

const connectDatabase = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/tabredon');
    console.log('MongoDB connected');
    
    // Initialize default data
    await createDefaultData();
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

module.exports = { connectDatabase };