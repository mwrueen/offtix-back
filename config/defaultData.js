const User = require('../models/User');
const Project = require('../models/Project');
const TaskStatus = require('../models/TaskStatus');
const Phase = require('../models/Phase');
const Sprint = require('../models/Sprint');

const createDefaultData = async () => {
  try {
    // Create admin accounts
    await createAdminAccounts();
    
    // Create sample project with default data
    await createSampleProject();
    
    console.log('Default data initialization completed');
  } catch (error) {
    console.error('Error creating default data:', error);
  }
};

const createAdminAccounts = async () => {
  const adminExists = await User.findOne({ email: 'admin@taskflow.com' });
  if (!adminExists) {
    await User.create({
      name: 'Admin User',
      email: 'admin@taskflow.com',
      password: 'admin123',
      role: 'admin'
    });
    console.log('Admin account created: admin@taskflow.com / admin123');
  }

  const superAdminExists = await User.findOne({ email: 'superadmin@taskflow.com' });
  if (!superAdminExists) {
    await User.create({
      name: 'Super Admin',
      email: 'superadmin@taskflow.com',
      password: 'superadmin123',
      role: 'superadmin'
    });
    console.log('Super Admin account created: superadmin@taskflow.com / superadmin123');
  }

  // Create demo user
  const demoExists = await User.findOne({ email: 'demo@tabredon.com' });
  if (!demoExists) {
    await User.create({
      name: 'Demo User',
      email: 'demo@tabredon.com',
      password: 'demo123',
      role: 'user'
    });
    console.log('Demo account created: demo@tabredon.com / demo123');
  }
};

const createSampleProject = async () => {
  const adminUser = await User.findOne({ email: 'admin@taskflow.com' });
  if (!adminUser) return;

  const existingProject = await Project.findOne({ title: 'Sample Project - Tabredon Demo' });
  if (existingProject) return;

  // Create sample project
  const project = await Project.create({
    title: 'Sample Project - Tabredon Demo',
    description: 'This is a sample project to demonstrate Tabredon\'s features including task management, sprints, phases, and different view modes.',
    status: 'active',
    priority: 'high',
    owner: adminUser._id,
    members: [adminUser._id]
  });

  // Create default task statuses
  const statuses = await TaskStatus.insertMany([
    { name: 'To Do', color: '#6b7280', order: 0, project: project._id },
    { name: 'In Progress', color: '#3b82f6', order: 1, project: project._id },
    { name: 'Review', color: '#f59e0b', order: 2, project: project._id },
    { name: 'Testing', color: '#8b5cf6', order: 3, project: project._id },
    { name: 'Done', color: '#10b981', order: 4, project: project._id }
  ]);

  // Create default phases
  const phases = await Phase.insertMany([
    { name: 'Planning', description: 'Project planning and requirement gathering', order: 0, project: project._id, status: 'completed' },
    { name: 'Development', description: 'Core development phase', order: 1, project: project._id, status: 'active' },
    { name: 'Testing', description: 'Quality assurance and testing', order: 2, project: project._id, status: 'planning' },
    { name: 'Deployment', description: 'Production deployment and launch', order: 3, project: project._id, status: 'planning' }
  ]);

  // Create default sprints
  const now = new Date();
  const sprints = await Sprint.insertMany([
    {
      name: 'Sprint 1 - Foundation',
      sprintNumber: 1,
      startDate: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000),
      endDate: now,
      goal: 'Set up project foundation and basic features',
      status: 'completed',
      project: project._id
    },
    {
      name: 'Sprint 2 - Core Features',
      sprintNumber: 2,
      startDate: now,
      endDate: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000),
      goal: 'Implement core task management features',
      status: 'active',
      project: project._id
    },
    {
      name: 'Sprint 3 - Advanced Views',
      sprintNumber: 3,
      startDate: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000),
      endDate: new Date(now.getTime() + 28 * 24 * 60 * 60 * 1000),
      goal: 'Add board and gantt views',
      status: 'planning',
      project: project._id
    }
  ]);

  console.log(`Sample project created: ${project.title}`);
  console.log(`Created ${statuses.length} task statuses`);
  console.log(`Created ${phases.length} phases`);
  console.log(`Created ${sprints.length} sprints`);
};

module.exports = { createDefaultData };