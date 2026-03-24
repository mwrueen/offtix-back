/**
 * Resets all tasks in a given project to:
 *   - Status  → "To Do" (matched by name, case-insensitive)
 *   - dueDate → removed
 *   - startDate → removed
 *   - duration  → removed
 *
 * Usage:
 *   node scripts/resetTasksToTodo.js <projectId>
 */

const mongoose = require('mongoose');
const Task = require('../models/Task');
const TaskStatus = require('../models/TaskStatus');
require('dotenv').config();

const PROJECT_ID = process.argv[2];

if (!PROJECT_ID) {
  console.error('❌  Usage: node scripts/resetTasksToTodo.js <projectId>');
  process.exit(1);
}

const main = async () => {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/offtix');
  console.log('✅ Connected to MongoDB');

  // Find the "To Do" status for this project
  const todoStatus = await TaskStatus.findOne({
    project: PROJECT_ID,
    name: /^to.?do$/i   // matches "Todo", "To Do", "to do", etc.
  });

  if (!todoStatus) {
    // List available statuses so the user can see what exists
    const statuses = await TaskStatus.find({ project: PROJECT_ID }).select('name').lean();
    console.error('❌  No "To Do" status found for this project.');
    console.error('   Available statuses:', statuses.map(s => s.name).join(', ') || '(none)');
    await mongoose.disconnect();
    process.exit(1);
  }

  console.log(`📋 Found status: "${todoStatus.name}" (${todoStatus._id})`);

  // Count tasks before updating
  const total = await Task.countDocuments({ project: PROJECT_ID });
  console.log(`🔢 Tasks in project: ${total}`);

  if (total === 0) {
    console.log('ℹ️  No tasks found — nothing to update.');
    await mongoose.disconnect();
    process.exit(0);
  }

  // Update all tasks in one query
  const result = await Task.updateMany(
    { project: PROJECT_ID },
    {
      $set:   { status: todoStatus._id },
      $unset: { dueDate: '', startDate: '', 'duration.value': '' }
    }
  );

  console.log(`✅ Updated ${result.modifiedCount} / ${total} tasks:`);
  console.log(`   • Status  → "${todoStatus.name}"`);
  console.log(`   • dueDate → removed`);
  console.log(`   • startDate → removed`);
  console.log(`   • duration  → removed`);

  await mongoose.disconnect();
  console.log('🔌 Disconnected from MongoDB');
};

main().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});

