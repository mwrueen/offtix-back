require('dotenv').config();
const mongoose = require('mongoose');
require('../models/TaskStatus');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/tabredon');
  
  const all = await mongoose.model('TaskStatus').find().lean();
  console.log('All TaskStatus records:');
  all.forEach(s => {
    console.log(`  ${s._id}: name="${s.name}" slug="${s.slug}" isCompleted=${s.isCompleted}`);
  });
  
  const paused = await mongoose.model('TaskStatus').findOne({ name: /^paused$/i }).lean();
  console.log('\nPaused status lookup:', paused);
  
  await mongoose.disconnect();
})();
