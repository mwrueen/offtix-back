require('dotenv').config();
const mongoose = require('mongoose');
const { createDefaultData } = require('../config/defaultData');

const resetDatabase = async () => {
  try {
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/offtix';
    console.log(`Connecting to database to reset: ${uri}`);
    await mongoose.connect(uri);
    console.log('Connected to database.');

    // Drop the database
    console.log('Dropping database...');
    await mongoose.connection.db.dropDatabase();
    console.log('Database dropped successfully.');

    // Seed default data
    console.log('Running default data seeder...');
    await createDefaultData();

    console.log('Database reset and seed completed successfully.');
    
    // Close the connection
    await mongoose.connection.close();
    console.log('Connection closed.');
    process.exit(0);
  } catch (error) {
    console.error('Error resetting database:', error);
    process.exit(1);
  }
};

resetDatabase();
