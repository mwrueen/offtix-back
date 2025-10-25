const express = require('express');
const cors = require('cors');
const path = require('path');
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

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

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
app.use('/api/projects', projectRoutes);
app.use('/api/projects/:projectId/tasks', taskRoutes);
app.use('/api/projects/:projectId/task-statuses', taskStatusRoutes);
app.use('/api/projects/:projectId/requirements', requirementRoutes);
app.use('/api/projects/:projectId/meeting-notes', meetingNoteRoutes);
app.use('/api/projects/:projectId/sprints', sprintRoutes);
app.use('/api/projects/:projectId/phases', phaseRoutes);

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