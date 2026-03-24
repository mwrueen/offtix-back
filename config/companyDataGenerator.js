const User = require('../models/User');
const Company = require('../models/Company');
const Project = require('../models/Project');
const Task = require('../models/Task');
const TaskStatus = require('../models/TaskStatus');
const TaskRole = require('../models/TaskRole');
const Phase = require('../models/Phase');
const Sprint = require('../models/Sprint');

// Company data
const companyData = {
  name: 'TechFlow Solutions',
  description: 'A leading software development company specializing in web applications, mobile apps, and enterprise solutions.',
  industry: 'Software Development',
  website: 'https://techflowsolutions.com',
  email: 'info@techflowsolutions.com',
  phone: '+1-555-0123',
  address: '123 Innovation Drive',
  city: 'San Francisco',
  state: 'California',
  country: 'United States',
  zipCode: '94105',
  foundedYear: 2018,
  companySize: '51-100 employees',
  currency: 'USD'
};

// Employee data with various roles and departments
const employeesData = [
  // Executive Level
  { name: 'Sarah Johnson', email: 'sarah.johnson@techflow.com', designation: 'Managing Director', department: 'Executive', salary: 180000, skills: ['Leadership', 'Strategy', 'Business Development'] },
  { name: 'Michael Chen', email: 'michael.chen@techflow.com', designation: 'HR Manager', department: 'Human Resources', salary: 95000, skills: ['HR Management', 'Recruitment', 'Employee Relations'] },
  
  // Project Management
  { name: 'Emily Rodriguez', email: 'emily.rodriguez@techflow.com', designation: 'Project Manager', department: 'Project Management', salary: 105000, skills: ['Agile', 'Scrum', 'Project Planning', 'Risk Management'] },
  { name: 'David Kim', email: 'david.kim@techflow.com', designation: 'Project Manager', department: 'Project Management', salary: 102000, skills: ['Kanban', 'Waterfall', 'Stakeholder Management'] },
  { name: 'Lisa Thompson', email: 'lisa.thompson@techflow.com', designation: 'Project Manager', department: 'Project Management', salary: 98000, skills: ['Agile', 'Team Leadership', 'Budget Management'] },
  
  // Team Leads
  { name: 'James Wilson', email: 'james.wilson@techflow.com', designation: 'Team Lead', department: 'Frontend Development', salary: 115000, skills: ['React', 'Vue.js', 'TypeScript', 'Team Leadership'] },
  { name: 'Maria Garcia', email: 'maria.garcia@techflow.com', designation: 'Team Lead', department: 'Backend Development', salary: 118000, skills: ['Node.js', 'Python', 'Microservices', 'Team Leadership'] },
  { name: 'Robert Brown', email: 'robert.brown@techflow.com', designation: 'Team Lead', department: 'Mobile Development', salary: 112000, skills: ['React Native', 'Flutter', 'iOS', 'Android'] },
  { name: 'Jennifer Davis', email: 'jennifer.davis@techflow.com', designation: 'Team Lead', department: 'QA Testing', salary: 95000, skills: ['Test Automation', 'Selenium', 'Quality Assurance'] },
  { name: 'Christopher Lee', email: 'christopher.lee@techflow.com', designation: 'Team Lead', department: 'DevOps', salary: 125000, skills: ['AWS', 'Docker', 'Kubernetes', 'CI/CD'] },
  
  // Senior Developers
  { name: 'Amanda White', email: 'amanda.white@techflow.com', designation: 'Senior Employee', department: 'Frontend Development', salary: 95000, skills: ['React', 'Angular', 'JavaScript', 'CSS'] },
  { name: 'Daniel Martinez', email: 'daniel.martinez@techflow.com', designation: 'Senior Employee', department: 'Backend Development', salary: 98000, skills: ['Java', 'Spring Boot', 'PostgreSQL', 'Redis'] },
  { name: 'Jessica Taylor', email: 'jessica.taylor@techflow.com', designation: 'Senior Employee', department: 'Full Stack Development', salary: 92000, skills: ['MERN Stack', 'GraphQL', 'MongoDB'] },
  { name: 'Kevin Anderson', email: 'kevin.anderson@techflow.com', designation: 'Senior Employee', department: 'Mobile Development', salary: 90000, skills: ['Swift', 'Kotlin', 'React Native'] },
  { name: 'Rachel Thomas', email: 'rachel.thomas@techflow.com', designation: 'Senior Employee', department: 'DevOps', salary: 105000, skills: ['Terraform', 'Jenkins', 'Monitoring'] },
  
  // Mid-Level Developers
  { name: 'Steven Jackson', email: 'steven.jackson@techflow.com', designation: 'Employee', department: 'Frontend Development', salary: 75000, skills: ['React', 'JavaScript', 'HTML/CSS'] },
  { name: 'Nicole Harris', email: 'nicole.harris@techflow.com', designation: 'Employee', department: 'Backend Development', salary: 78000, skills: ['Python', 'Django', 'MySQL'] },
  { name: 'Brandon Clark', email: 'brandon.clark@techflow.com', designation: 'Employee', department: 'Frontend Development', salary: 72000, skills: ['Vue.js', 'Nuxt.js', 'SASS'] },
  { name: 'Stephanie Lewis', email: 'stephanie.lewis@techflow.com', designation: 'Employee', department: 'QA Testing', salary: 65000, skills: ['Manual Testing', 'Test Cases', 'Bug Tracking'] },
  { name: 'Gregory Walker', email: 'gregory.walker@techflow.com', designation: 'Employee', department: 'Backend Development', salary: 76000, skills: ['C#', '.NET Core', 'SQL Server'] },
  
  // Junior Developers
  { name: 'Ashley Hall', email: 'ashley.hall@techflow.com', designation: 'Employee', department: 'Frontend Development', salary: 58000, skills: ['HTML', 'CSS', 'JavaScript', 'React'] },
  { name: 'Ryan Allen', email: 'ryan.allen@techflow.com', designation: 'Employee', department: 'Backend Development', salary: 60000, skills: ['Node.js', 'Express', 'MongoDB'] },
  { name: 'Megan Young', email: 'megan.young@techflow.com', designation: 'Employee', department: 'Mobile Development', salary: 62000, skills: ['Flutter', 'Dart', 'Firebase'] },
  { name: 'Tyler King', email: 'tyler.king@techflow.com', designation: 'Employee', department: 'QA Testing', salary: 55000, skills: ['Postman', 'API Testing', 'Regression Testing'] },
  { name: 'Samantha Wright', email: 'samantha.wright@techflow.com', designation: 'Employee', department: 'Frontend Development', salary: 57000, skills: ['Angular', 'TypeScript', 'RxJS'] },
  
  // Additional Team Members
  { name: 'Jonathan Lopez', email: 'jonathan.lopez@techflow.com', designation: 'Employee', department: 'Backend Development', salary: 74000, skills: ['Ruby', 'Rails', 'PostgreSQL'] },
  { name: 'Brittany Hill', email: 'brittany.hill@techflow.com', designation: 'Employee', department: 'UI/UX Design', salary: 68000, skills: ['Figma', 'Adobe XD', 'Prototyping'] },
  { name: 'Joshua Scott', email: 'joshua.scott@techflow.com', designation: 'Employee', department: 'DevOps', salary: 82000, skills: ['Linux', 'Bash', 'Monitoring'] },
  { name: 'Kimberly Green', email: 'kimberly.green@techflow.com', designation: 'Employee', department: 'Data Analysis', salary: 70000, skills: ['Python', 'Pandas', 'SQL'] },
  { name: 'Andrew Adams', email: 'andrew.adams@techflow.com', designation: 'Employee', department: 'Backend Development', salary: 73000, skills: ['Go', 'Microservices', 'Docker'] },
  
  { name: 'Michelle Baker', email: 'michelle.baker@techflow.com', designation: 'Employee', department: 'Frontend Development', salary: 69000, skills: ['React', 'Redux', 'Webpack'] },
  { name: 'Jason Gonzalez', email: 'jason.gonzalez@techflow.com', designation: 'Employee', department: 'Mobile Development', salary: 71000, skills: ['Xamarin', 'C#', 'Azure'] },
  { name: 'Laura Nelson', email: 'laura.nelson@techflow.com', designation: 'Employee', department: 'QA Testing', salary: 63000, skills: ['Cypress', 'Jest', 'Test Automation'] },
  { name: 'Matthew Carter', email: 'matthew.carter@techflow.com', designation: 'Employee', department: 'Backend Development', salary: 77000, skills: ['PHP', 'Laravel', 'MySQL'] },
  { name: 'Heather Mitchell', email: 'heather.mitchell@techflow.com', designation: 'Employee', department: 'Frontend Development', salary: 66000, skills: ['Svelte', 'JavaScript', 'CSS Grid'] },
  
  { name: 'Eric Perez', email: 'eric.perez@techflow.com', designation: 'Employee', department: 'DevOps', salary: 85000, skills: ['Ansible', 'Prometheus', 'Grafana'] },
  { name: 'Crystal Roberts', email: 'crystal.roberts@techflow.com', designation: 'Employee', department: 'UI/UX Design', salary: 64000, skills: ['Sketch', 'InVision', 'User Research'] },
  { name: 'Nathan Turner', email: 'nathan.turner@techflow.com', designation: 'Employee', department: 'Backend Development', salary: 75000, skills: ['Rust', 'WebAssembly', 'Performance'] },
  { name: 'Vanessa Phillips', email: 'vanessa.phillips@techflow.com', designation: 'Employee', department: 'Data Science', salary: 88000, skills: ['Machine Learning', 'TensorFlow', 'R'] },
  { name: 'Carl Campbell', email: 'carl.campbell@techflow.com', designation: 'Employee', department: 'Security', salary: 92000, skills: ['Cybersecurity', 'Penetration Testing', 'OWASP'] },
  
  { name: 'Denise Parker', email: 'denise.parker@techflow.com', designation: 'Employee', department: 'Frontend Development', salary: 67000, skills: ['Next.js', 'Tailwind CSS', 'GraphQL'] },
  { name: 'Marcus Evans', email: 'marcus.evans@techflow.com', designation: 'Employee', department: 'Mobile Development', salary: 70000, skills: ['Unity', 'C#', 'Game Development'] },
  { name: 'Tiffany Edwards', email: 'tiffany.edwards@techflow.com', designation: 'Employee', department: 'QA Testing', salary: 61000, skills: ['LoadRunner', 'Performance Testing', 'JMeter'] },
  { name: 'Sean Collins', email: 'sean.collins@techflow.com', designation: 'Employee', department: 'Backend Development', salary: 79000, skills: ['Scala', 'Akka', 'Kafka'] },
  { name: 'Cheryl Stewart', email: 'cheryl.stewart@techflow.com', designation: 'Employee', department: 'Product Management', salary: 95000, skills: ['Product Strategy', 'Market Research', 'Roadmapping'] },
  
  { name: 'Wayne Sanchez', email: 'wayne.sanchez@techflow.com', designation: 'Employee', department: 'DevOps', salary: 83000, skills: ['GitLab CI', 'Helm', 'Service Mesh'] },
  { name: 'Gloria Morris', email: 'gloria.morris@techflow.com', designation: 'Employee', department: 'Technical Writing', salary: 62000, skills: ['Documentation', 'API Docs', 'Technical Communication'] },
  { name: 'Keith Rogers', email: 'keith.rogers@techflow.com', designation: 'Employee', department: 'Backend Development', salary: 76000, skills: ['Elixir', 'Phoenix', 'Distributed Systems'] },
  { name: 'Jacqueline Reed', email: 'jacqueline.reed@techflow.com', designation: 'Employee', department: 'Frontend Development', salary: 68000, skills: ['Gatsby', 'JAMstack', 'Headless CMS'] },
  { name: 'Eugene Cook', email: 'eugene.cook@techflow.com', designation: 'Employee', department: 'Database Administration', salary: 87000, skills: ['PostgreSQL', 'MongoDB', 'Database Optimization'] },
  { name: 'Theresa Bailey', email: 'theresa.bailey@techflow.com', designation: 'Employee', department: 'Business Analysis', salary: 78000, skills: ['Requirements Analysis', 'Process Modeling', 'Stakeholder Management'] }
];

// Projects data
const projectsData = [
  {
    title: 'E-Commerce Platform Redesign',
    description: 'Complete redesign and modernization of the company\'s e-commerce platform using React and microservices architecture.',
    status: 'running',
    priority: 'high',
    budget: { amount: 250000, currency: 'USD' },
    tags: ['e-commerce', 'react', 'microservices'],
    departments: ['Frontend Development', 'Backend Development', 'UI/UX Design', 'QA Testing']
  },
  {
    title: 'Mobile Banking Application',
    description: 'Development of a secure mobile banking application for iOS and Android platforms with biometric authentication.',
    status: 'running',
    priority: 'urgent',
    budget: { amount: 180000, currency: 'USD' },
    tags: ['mobile', 'banking', 'security', 'fintech'],
    departments: ['Mobile Development', 'Backend Development', 'Security', 'QA Testing']
  },
  {
    title: 'AI-Powered Analytics Dashboard',
    description: 'Creation of an intelligent analytics dashboard using machine learning for business intelligence and data visualization.',
    status: 'running',
    priority: 'high',
    budget: { amount: 200000, currency: 'USD' },
    tags: ['ai', 'analytics', 'dashboard', 'ml'],
    departments: ['Data Science', 'Frontend Development', 'Backend Development', 'Data Analysis']
  },
  {
    title: 'Cloud Migration Project',
    description: 'Migration of legacy systems to AWS cloud infrastructure with improved scalability and performance.',
    status: 'running',
    priority: 'medium',
    budget: { amount: 150000, currency: 'USD' },
    tags: ['cloud', 'aws', 'migration', 'infrastructure'],
    departments: ['DevOps', 'Backend Development', 'Database Administration']
  },
  {
    title: 'Customer Support Portal',
    description: 'Development of a comprehensive customer support portal with ticketing system and knowledge base.',
    status: 'not_started',
    priority: 'medium',
    budget: { amount: 120000, currency: 'USD' },
    tags: ['support', 'portal', 'ticketing'],
    departments: ['Full Stack Development', 'UI/UX Design', 'QA Testing']
  },
  {
    title: 'IoT Device Management System',
    description: 'Building a scalable IoT device management system for monitoring and controlling connected devices.',
    status: 'running',
    priority: 'high',
    budget: { amount: 300000, currency: 'USD' },
    tags: ['iot', 'devices', 'monitoring', 'real-time'],
    departments: ['Backend Development', 'Frontend Development', 'DevOps', 'Data Analysis']
  }
];

// Clean up all data created by a previous (possibly partial) run.
const cleanCompanyData = async () => {
  const company = await Company.findOne({ name: companyData.name });
  if (!company) {
    // No company — just make sure the seed emails are also removed
    const seedEmails = employeesData.map(e => e.email);
    const result = await User.deleteMany({ email: { $in: seedEmails } });
    console.log(`🗑️  Removed ${result.deletedCount} orphaned seed user(s).`);
    return;
  }

  // Remove all documents tied to this company
  const [tasks, taskStatuses, taskRoles, phases, sprints, projects] = await Promise.all([
    Task.deleteMany({ company: company._id }),
    TaskStatus.deleteMany({ project: { $in: await Project.find({ company: company._id }).distinct('_id') } }),
    TaskRole.deleteMany({ project: { $in: await Project.find({ company: company._id }).distinct('_id') } }),
    Phase.deleteMany({ project: { $in: await Project.find({ company: company._id }).distinct('_id') } }),
    Sprint.deleteMany({ project: { $in: await Project.find({ company: company._id }).distinct('_id') } }),
    Project.deleteMany({ company: company._id }),
  ]);

  // Remove seed users (all employees including CEO)
  const seedEmails = employeesData.map(e => e.email);
  const usersResult = await User.deleteMany({ email: { $in: seedEmails } });

  await Company.deleteOne({ _id: company._id });

  console.log(`🗑️  Deleted company "${company.name}" and all its data:`);
  console.log(`   - Users:    ${usersResult.deletedCount}`);
  console.log(`   - Projects: ${projects.deletedCount}`);
};

// Helper: find an existing user by email or create a new one.
// Avoids duplicate-key errors when re-running the script after a partial failure.
const findOrCreateUser = async (userData) => {
  const existing = await User.findOne({ email: userData.email });
  if (existing) return existing;
  return User.create(userData);
};

const generateCompanyData = async () => {
  try {
    console.log('🚀 Starting company data generation...');

    // Check if company already exists
    const existingCompany = await Company.findOne({ name: companyData.name });
    if (existingCompany) {
      console.log('❌ Company already exists. Skipping generation.');
      return;
    }

    // Create (or reuse) company owner (CEO) — employeesData[0] = Sarah Johnson
    const ceoData = employeesData[0];
    const ceo = await findOrCreateUser({
      name: ceoData.name,
      email: ceoData.email,
      password: 'password123',
      role: 'admin',
      profile: {
        title: ceoData.designation,
        skills: ceoData.skills,
        phone: '+1-555-0001'
      }
    });

    console.log(`✅ Created CEO: ${ceo.name} (${ceo.email})`);

    // Create company
    const company = await Company.create({
      ...companyData,
      owner: ceo._id
    });

    console.log(`✅ Created company: ${company.name}`);

    // Create all employees.
    // Start from index 1 — index 0 (CEO / Sarah Johnson) is already created above.
    const employees = [ceo]; // pre-populate with CEO so project assignment works
    for (let i = 1; i < employeesData.length; i++) {
      const empData = employeesData[i];

      const employee = await findOrCreateUser({
        name: empData.name,
        email: empData.email,
        password: 'password123',
        role: 'user',
        company: company._id,
        profile: {
          title: empData.designation,
          skills: empData.skills,
          phone: `+1-555-${String(i + 1).padStart(4, '0')}`,
          location: 'San Francisco, CA'
        }
      });

      employees.push(employee);

      // Add employee to company
      company.members.push({
        user: employee._id,
        designation: empData.designation,
        currentSalary: empData.salary,
        salaryHistory: [{
          amount: empData.salary,
          effectiveDate: new Date(),
          reason: 'Initial salary',
          updatedBy: ceo._id
        }]
      });
    }

    // Also add CEO to company members
    company.members.unshift({
      user: ceo._id,
      designation: ceoData.designation,
      currentSalary: ceoData.salary,
      salaryHistory: [{
        amount: ceoData.salary,
        effectiveDate: new Date(),
        reason: 'Initial salary',
        updatedBy: ceo._id
      }]
    });

    await company.save();
    console.log(`✅ Created ${employees.length} employees`);

    // Create projects with teams
    const projects = [];
    for (const projectData of projectsData) {
      // Find project manager
      const projectManager = employees.find(emp => 
        emp.profile.title === 'Project Manager'
      );

      // Create project
      const project = await Project.create({
        title: projectData.title,
        description: projectData.description,
        status: projectData.status,
        priority: projectData.priority,
        budget: projectData.budget,
        tags: projectData.tags,
        owner: projectManager._id,
        company: company._id,
        startDate: new Date(),
        scheduledStartDate: new Date()
      });

      // Assign team members based on departments
      const teamMembers = [];
      
      // Add project manager
      teamMembers.push({
        user: projectManager._id,
        role: 'Project Manager'
      });

      // Add team leads and employees from relevant departments
      for (const dept of projectData.departments) {
        // Find team lead for this department
        const teamLead = employees.find(emp => 
          emp.profile.title === 'Team Lead' && 
          employeesData.find(ed => ed.email === emp.email)?.department === dept
        );
        
        if (teamLead) {
          teamMembers.push({
            user: teamLead._id,
            role: 'Team Lead'
          });
        }

        // Add 2-4 employees from this department
        const deptEmployees = employees.filter(emp => {
          const empData = employeesData.find(ed => ed.email === emp.email);
          return empData?.department === dept && emp.profile.title === 'Employee';
        }).slice(0, Math.floor(Math.random() * 3) + 2);

        deptEmployees.forEach(emp => {
          teamMembers.push({
            user: emp._id,
            role: 'Developer'
          });
        });
      }

      project.members = teamMembers;
      await project.save();
      projects.push(project);

      console.log(`✅ Created project: ${project.title} with ${teamMembers.length} members`);
    }

    // Create task statuses, phases, sprints, and tasks for each project
    for (const project of projects) {
      // Create task statuses
      const taskStatuses = await TaskStatus.insertMany([
        { name: 'Backlog', color: '#6b7280', order: 0, project: project._id },
        { name: 'To Do', color: '#3b82f6', order: 1, project: project._id },
        { name: 'In Progress', color: '#f59e0b', order: 2, project: project._id },
        { name: 'Code Review', color: '#8b5cf6', order: 3, project: project._id },
        { name: 'Testing', color: '#ef4444', order: 4, project: project._id },
        { name: 'Done', color: '#10b981', order: 5, project: project._id }
      ]);

      // Create phases
      const phases = await Phase.insertMany([
        { name: 'Planning', description: 'Project planning and analysis', order: 0, project: project._id, status: 'completed' },
        { name: 'Design', description: 'UI/UX design and architecture', order: 1, project: project._id, status: 'active' },
        { name: 'Development', description: 'Core development phase', order: 2, project: project._id, status: 'planning' },
        { name: 'Testing', description: 'Quality assurance and testing', order: 3, project: project._id, status: 'planning' },
        { name: 'Deployment', description: 'Production deployment', order: 4, project: project._id, status: 'planning' }
      ]);

      // Create sprints
      const now = new Date();
      const sprints = await Sprint.insertMany([
        {
          name: 'Sprint 1 - Foundation',
          sprintNumber: 1,
          startDate: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000),
          endDate: now,
          goal: 'Set up project foundation',
          status: 'completed',
          project: project._id
        },
        {
          name: 'Sprint 2 - Core Features',
          sprintNumber: 2,
          startDate: now,
          endDate: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000),
          goal: 'Implement core features',
          status: 'active',
          project: project._id
        },
        {
          name: 'Sprint 3 - Integration',
          sprintNumber: 3,
          startDate: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000),
          endDate: new Date(now.getTime() + 28 * 24 * 60 * 60 * 1000),
          goal: 'System integration and testing',
          status: 'planning',
          project: project._id
        }
      ]);

      // Create tasks for the project
      const taskTemplates = [
        'Setup development environment',
        'Create database schema',
        'Implement user authentication',
        'Design user interface mockups',
        'Develop API endpoints',
        'Create frontend components',
        'Write unit tests',
        'Perform integration testing',
        'Setup CI/CD pipeline',
        'Deploy to staging environment',
        'Performance optimization',
        'Security audit',
        'User acceptance testing',
        'Documentation update',
        'Code review and refactoring'
      ];

      const tasks = [];
      const projectMembers = project.members.filter(m => m.role !== 'Project Manager');
      
      for (let i = 0; i < taskTemplates.length; i++) {
        const randomMember = projectMembers[Math.floor(Math.random() * projectMembers.length)];
        const randomStatus = taskStatuses[Math.floor(Math.random() * taskStatuses.length)];
        const randomPhase = phases[Math.floor(Math.random() * phases.length)];
        const randomSprint = sprints[Math.floor(Math.random() * 2)]; // Only first 2 sprints
        
        const task = await Task.create({
          title: taskTemplates[i],
          description: `${taskTemplates[i]} for ${project.title}`,
          status: randomStatus._id,
          priority: ['low', 'medium', 'high'][Math.floor(Math.random() * 3)],
          project: project._id,
          phase: randomPhase._id,
          sprint: randomSprint._id,
          assignees: [randomMember.user],
          duration: {
            value: Math.floor(Math.random() * 16) + 4, // 4-20 hours
            unit: 'hours'
          },
          startDate: new Date(now.getTime() - Math.random() * 7 * 24 * 60 * 60 * 1000),
          dueDate: new Date(now.getTime() + Math.random() * 14 * 24 * 60 * 60 * 1000),
          order: i,
          createdBy: project.owner
        });

        tasks.push(task);
      }

      console.log(`✅ Created ${tasks.length} tasks for ${project.title}`);
    }

    console.log('🎉 Company data generation completed successfully!');
    console.log(`📊 Summary:`);
    console.log(`   - Company: ${company.name}`);
    console.log(`   - Employees: ${employees.length}`);
    console.log(`   - Projects: ${projects.length}`);
    console.log(`   - Total Tasks: ${projects.length * 15}`);

  } catch (error) {
    console.error('❌ Error generating company data:', error);
    throw error;
  }
};

module.exports = { generateCompanyData, cleanCompanyData };