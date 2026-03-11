require('dotenv').config();
const mongoose = require('mongoose');
const Task = require('../models/Task');
const TaskStatus = require('../models/TaskStatus');
const User = require('../models/User');

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/tabredon');
    console.log('MongoDB connected');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

const convertToSequentialWorkflow = async () => {
  try {
    console.log('Starting conversion to sequential workflow...\n');

    // Find all tasks with multiple assignees
    const tasks = await Task.find({
      assignees: { $exists: true, $not: { $size: 0 } }
    }).populate('assignees', 'name email');

    console.log(`Found ${tasks.length} tasks with assignees`);

    let convertedCount = 0;
    let skippedCount = 0;

    for (const task of tasks) {
      // Skip if already using sequential workflow
      if (task.useSequentialWorkflow) {
        skippedCount++;
        continue;
      }

      // Skip if only one assignee
      if (task.assignees.length <= 1) {
        skippedCount++;
        continue;
      }

      // Convert to sequential workflow
      task.sequentialAssignees = task.assignees.map((assignee, index) => ({
        user: assignee._id,
        order: index,
        status: index === 0 ? 'active' : 'pending',
        startedAt: index === 0 ? new Date() : null
      }));

      task.currentAssigneeIndex = 0;
      task.useSequentialWorkflow = true;

      await task.save();
      convertedCount++;

      console.log(`✓ Converted task: "${task.title}" (${task.assignees.length} assignees)`);
    }

    console.log('\n========================================');
    console.log('Conversion completed!');
    console.log('========================================');
    console.log(`Total tasks processed: ${tasks.length}`);
    console.log(`Converted to sequential: ${convertedCount}`);
    console.log(`Skipped: ${skippedCount}`);
    console.log('========================================\n');

  } catch (error) {
    console.error('Error during conversion:', error);
  } finally {
    await mongoose.connection.close();
    console.log('Database connection closed');
  }
};

// Run the script
connectDB().then(() => {
  convertToSequentialWorkflow();
});
