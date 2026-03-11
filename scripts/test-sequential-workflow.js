require('dotenv').config();
const mongoose = require('mongoose');
const Task = require('../models/Task');
const User = require('../models/User');
const Project = require('../models/Project');
const TaskStatus = require('../models/TaskStatus');

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/tabredon');
    console.log('MongoDB connected');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

const testSequentialWorkflow = async () => {
  try {
    console.log('Testing Sequential Workflow...\n');

    // Find a project
    const project = await Project.findOne();
    if (!project) {
      console.error('No project found. Please create a project first.');
      return;
    }
    console.log(`Using project: ${project.title}`);

    // Find 3 users
    const users = await User.find().limit(3);
    if (users.length < 3) {
      console.error('Need at least 3 users. Please create more users.');
      return;
    }
    console.log(`Found ${users.length} users:`);
    users.forEach((u, i) => console.log(`  ${i + 1}. ${u.name} (${u.email})`));

    // Find a task status
    const status = await TaskStatus.findOne({ project: project._id });
    if (!status) {
      console.error('No task status found for this project.');
      return;
    }

    // Create a test task with sequential workflow
    const testTask = await Task.create({
      title: 'Test Sequential Workflow Task',
      description: 'This is a test task to verify sequential workflow functionality. Assignees must complete in order: Designer → Developer → QA.',
      project: project._id,
      status: status._id,
      priority: 'high',
      assignees: users.map(u => u._id),
      useSequentialWorkflow: true,
      sequentialAssignees: users.map((u, index) => ({
        user: u._id,
        order: index,
        status: index === 0 ? 'active' : 'pending',
        startedAt: index === 0 ? new Date() : null
      })),
      currentAssigneeIndex: 0,
      createdBy: users[0]._id
    });

    console.log('\n✓ Created test task with sequential workflow');
    console.log(`  Task ID: ${testTask._id}`);
    console.log(`  Title: ${testTask.title}`);
    console.log(`  Sequential Assignees:`);
    testTask.sequentialAssignees.forEach((sa, i) => {
      const user = users.find(u => u._id.equals(sa.user));
      console.log(`    ${i + 1}. ${user.name} - Status: ${sa.status}`);
    });

    console.log('\n========================================');
    console.log('Test Setup Complete!');
    console.log('========================================');
    console.log('\nNext Steps:');
    console.log(`1. Login as: ${users[0].email}`);
    console.log('2. Go to "My Tasks" page');
    console.log('3. You should see the test task with a "Start" button');
    console.log('4. Click "Start" to begin working');
    console.log('5. Click "Complete" to finish and pass to next assignee');
    console.log(`6. Login as: ${users[1].email} to continue the workflow`);
    console.log('========================================\n');

  } catch (error) {
    console.error('Error during test:', error);
  } finally {
    await mongoose.connection.close();
    console.log('Database connection closed');
  }
};

// Run the script
connectDB().then(() => {
  testSequentialWorkflow();
});
