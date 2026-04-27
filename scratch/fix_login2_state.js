require('dotenv').config();
const mongoose = require('mongoose');
require('../models/Task');
require('../models/TaskStatus');
require('../models/TaskActivity');
require('../models/User');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/tabredon');

  const Task = mongoose.model('Task');
  const TaskStatus = mongoose.model('TaskStatus');

  const todo = await TaskStatus.findOne({ name: /^to.do$/i }).lean();
  if (!todo) { console.error('No To Do status'); process.exit(1); }

  // Find Login 2 by parent
  const subtasks = await Task.find({ parent: '69e28756038e09f2e735a996' });
  for (const st of subtasks) {
    if (st.status?.toString() !== todo._id.toString() || st.activeUser || st.pausedAt) {
      st.status = todo._id;
      st.activeUser = null;
      st.pausedAt = null;
      st.startDate = undefined;
      await st.save();
      console.log(`✓ Reset "${st.title}" to To Do`);
    }
  }

  // Clean up legacy paused/started activities for clean testing
  const TaskActivity = mongoose.model('TaskActivity');
  const subtaskIds = subtasks.map(s => s._id);
  const del = await TaskActivity.deleteMany({ task: { $in: subtaskIds } });
  console.log(`✓ Deleted ${del.deletedCount} legacy activities`);

  await mongoose.disconnect();
})();
