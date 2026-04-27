require('dotenv').config();
const mongoose = require('mongoose');
require('../models/Task');
require('../models/TaskStatus');
require('../models/TaskActivity');
require('../models/User');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/tabredon');

  const subtasks = await mongoose.model('Task').find({ parent: '69e28756038e09f2e735a996' })
    .populate('status', 'name')
    .populate('activeUser', 'name email')
    .lean();

  console.log('=== Subtask raw state ===\n');
  subtasks.forEach(st => {
    console.log(`📋 ${st.title} (${st._id})`);
    console.log('   useRoleWorkflow:', st.useRoleWorkflow);
    console.log('   useSequentialWorkflow:', st.useSequentialWorkflow);
    console.log('   roleAssignments.length:', st.roleAssignments?.length || 0);
    console.log('   sequentialAssignees.length:', st.sequentialAssignees?.length || 0);
    console.log('   status:', st.status?.name);
    console.log('   activeUser:', st.activeUser ? `${st.activeUser.name} (${st.activeUser._id})` : 'NULL');
    console.log('');
  });

  // Show recent activities
  const acts = await mongoose.model('TaskActivity').find({
    task: { $in: subtasks.map(s => s._id) }
  })
    .populate('performedBy', 'name email')
    .sort({ createdAt: -1 })
    .limit(20)
    .lean();

  console.log('\n=== Recent activities ===');
  acts.forEach(a => {
    console.log(`${a.createdAt.toISOString()} | ${a.action} | by ${a.performedBy?.name} | task=${a.task}`);
  });

  await mongoose.disconnect();
})();
