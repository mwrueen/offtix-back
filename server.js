const express = require('express');
const cors = require('cors');
const path = require('path');
const session = require('express-session');
const passport = require('./config/passport');
require('dotenv').config();
const { connectDatabase } = require('./config/database');

const userRoutes = require('./routes/users');
const authRoutes = require('./routes/auth');
const projectRoutes = require('./routes/projects');
const companyRoutes = require('./routes/companies');
const taskRoutes = require('./routes/tasks');
const taskStatusRoutes = require('./routes/taskStatuses');
const requirementRoutes = require('./routes/requirements');
const meetingNoteRoutes = require('./routes/meetingNotes');
const sprintRoutes = require('./routes/sprints');
const phaseRoutes = require('./routes/phases');
const invitationRoutes = require('./routes/invitations');
const notificationRoutes = require('./routes/notifications');
const employeeRoutes = require('./routes/employees');
const holidayRoutes = require('./routes/holidays');
const leaveRoutes = require('./routes/leaves');

const app = express();

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Session configuration for passport
app.use(session({
  secret: process.env.JWT_SECRET || 'your-session-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Passport middleware
app.use(passport.initialize());
app.use(passport.session());

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Serve static files from React build
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'public')));
}

// Database connection
connectDatabase();

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/companies', companyRoutes);
app.use('/api/invitations', invitationRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/projects/:projectId/tasks', taskRoutes);
app.use('/api/projects/:projectId/task-statuses', taskStatusRoutes);
app.use('/api/projects/:projectId/requirements', requirementRoutes);
app.use('/api/projects/:projectId/meeting-notes', meetingNoteRoutes);
app.use('/api/projects/:projectId/sprints', sprintRoutes);
app.use('/api/projects/:projectId/phases', phaseRoutes);
app.use('/api/companies/:companyId/employees', employeeRoutes);
app.use('/api/companies/:companyId/holidays', holidayRoutes);
app.use('/api/companies/:companyId/leaves', leaveRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'Server running' });
});

// Serve React app for all non-API routes
if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  });
}

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log('File upload limit: 10MB');
});