
const mongoose = require('mongoose');
const User = require('./models/User');

async function checkUser() {
  await mongoose.connect('mongodb://localhost:27017/tabredon');
  const user = await User.findOne({ email: 'superadmin@taskflow.com' });
  console.log('User found:', JSON.stringify(user, null, 2));
  process.exit(0);
}

checkUser();
