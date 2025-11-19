const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// User Schema (simplified for testing)
const userSchema = new mongoose.Schema({
  name: String,
  email: String,
  password: String,
  role: String
});

userSchema.pre('save', async function(next) {
  console.log('Pre-save hook called');
  console.log('Is password modified?', this.isModified('password'));
  
  if (!this.isModified('password')) {
    console.log('Password not modified, skipping hash');
    return next();
  }
  
  console.log('Hashing password...');
  this.password = await bcrypt.hash(this.password, 12);
  console.log('Password hashed successfully');
  next();
});

userSchema.methods.comparePassword = async function(password) {
  return await bcrypt.compare(password, this.password);
};

const User = mongoose.model('TestUser', userSchema);

async function testPasswordUpdate() {
  try {
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/tabredon');
    console.log('Connected to MongoDB\n');

    // Find a test user (or create one)
    let user = await User.findOne({ email: 'test@example.com' });
    
    if (!user) {
      console.log('Creating test user...');
      user = new User({
        name: 'Test User',
        email: 'test@example.com',
        password: 'oldpassword',
        role: 'user'
      });
      await user.save();
      console.log('Test user created\n');
    }

    console.log('Testing password update...');
    console.log('Old password hash:', user.password.substring(0, 30) + '...\n');

    // Test old password
    const oldPasswordWorks = await user.comparePassword('oldpassword');
    console.log('Old password "oldpassword" works?', oldPasswordWorks);

    // Update password (simulating the controller logic)
    console.log('\nUpdating password to "newpassword"...');
    user.password = 'newpassword';
    user.markModified('password');
    await user.save();

    console.log('New password hash:', user.password.substring(0, 30) + '...\n');

    // Fetch user again from database
    user = await User.findOne({ email: 'test@example.com' });

    // Test new password
    const newPasswordWorks = await user.comparePassword('newpassword');
    console.log('New password "newpassword" works?', newPasswordWorks);

    const oldPasswordStillWorks = await user.comparePassword('oldpassword');
    console.log('Old password "oldpassword" still works?', oldPasswordStillWorks);

    console.log('\n✅ Test completed successfully!');
    
    // Cleanup
    await User.deleteOne({ email: 'test@example.com' });
    console.log('Test user deleted');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await mongoose.connection.close();
    console.log('Database connection closed');
  }
}

testPasswordUpdate();

