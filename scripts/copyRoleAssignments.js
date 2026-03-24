/**
 * Copies the role assignments from a template task to all other tasks
 * in the same project.
 *
 * Usage:
 *   node scripts/copyRoleAssignments.js <projectId> <templateTaskTitle>
 */

const mongoose = require('mongoose');
require('../models/User'); // register User schema before Task populate
const Task = require('../models/Task');
require('dotenv').config();

const PROJECT_ID  = process.argv[2];
const TEMPLATE_TITLE = process.argv[3] || 'Setup development environment';

if (!PROJECT_ID) {
  console.error('❌  Usage: node scripts/copyRoleAssignments.js <projectId> [templateTaskTitle]');
  process.exit(1);
}

const main = async () => {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/offtix');
  console.log('✅ Connected to MongoDB');

  // Find the template task
  const template = await Task.findOne({
    project: PROJECT_ID,
    title: { $regex: new RegExp(TEMPLATE_TITLE, 'i') }
  }).lean();

  if (!template) {
    console.error(`❌  Template task not found: "${TEMPLATE_TITLE}"`);
    await mongoose.disconnect();
    process.exit(1);
  }

  if (!template.roleAssignments || template.roleAssignments.length === 0) {
    console.error(`❌  Template task "${template.title}" has no role assignments.`);
    await mongoose.disconnect();
    process.exit(1);
  }

  console.log(`📋 Template: "${template.title}"`);
  console.log(`   useRoleWorkflow: ${template.useRoleWorkflow}`);
  console.log(`   Role assignments (${template.roleAssignments.length}):`);
  template.roleAssignments.forEach(ra => {
    console.log(`     • role: ${ra.role}  assignees: [${ra.assignees.join(', ')}]  status: ${ra.status}`);
  });

  // Build the role assignments to copy — reset statuses to 'pending'
  const roleAssignmentsToCopy = template.roleAssignments.map(ra => ({
    role:        ra.role,
    order:       ra.order,
    assignees:   ra.assignees,
    status:      'pending',
    startedAt:   undefined,
    completedAt: undefined,
    duration:    ra.duration,
    startDate:   undefined,
    dueDate:     undefined,
    handoff:     undefined,
  }));

  // Find all OTHER tasks in the project
  const otherTasks = await Task.find({
    project: PROJECT_ID,
    _id:     { $ne: template._id }
  }).lean();

  console.log(`\n🔄 Applying to ${otherTasks.length} tasks...`);

  let updated = 0;
  for (const task of otherTasks) {
    await Task.updateOne(
      { _id: task._id },
      {
        $set: {
          roleAssignments:  roleAssignmentsToCopy,
          useRoleWorkflow:  true,
          currentRoleIndex: -1,
        }
      }
    );
    console.log(`   ✅ "${task.title}"`);
    updated++;
  }

  console.log(`\n🎉 Done! Updated ${updated} tasks with role assignments from "${template.title}".`);
  await mongoose.disconnect();
  console.log('🔌 Disconnected');
};

main().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});

