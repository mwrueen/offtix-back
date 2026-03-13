// Load environment variables first
require('dotenv').config();

const express = require('express');
const http = require('http');
const cors = require('cors');
const path = require('path');
const session = require('express-session');
const passport = require('./config/passport');
const { connectDatabase } = require('./config/database');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

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
const chatRoutes = require('./routes/chat');
const taskRoleRoutes = require('./routes/taskRoles');
const adminRoutes = require('./routes/admin');
const myTasksRoutes = require('./routes/myTasks');

const app = express();
const server = http.createServer(app);

// Socket.io setup with CORS
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Make io accessible to routes
app.set('io', io);

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
app.use('/api/projects/:projectId/chat', chatRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/task-roles', taskRoleRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/my-tasks', myTasksRoutes);
app.use('/api/team-activity', require('./routes/teamActivity'));

app.get('/api/health', (req, res) => {
  res.json({ status: 'Server running' });
});

// Socket.io authentication middleware
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) {
    return next(new Error('Authentication error: No token provided'));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = decoded.userId;
    socket.user = decoded;
    next();
  } catch (err) {
    next(new Error('Authentication error: Invalid token'));
  }
});

// Socket.io connection handling
const User = require('./models/User');
const Message = require('./models/Message');
const Project = require('./models/Project');

io.on('connection', async (socket) => {
  console.log(`User connected: ${socket.userId}`);

  // Join user to their own room for private notifications and DMs
  socket.join(`user:${socket.userId}`);

  // Join a room (project, company)
  socket.on('join-room', async (data) => {
    try {
      const { type, id } = data; // type: 'project' or 'company'

      if (type === 'project') {
        const project = await Project.findOne({
          _id: id,
          $or: [{ owner: socket.userId }, { 'members.user': socket.userId }]
        });
        if (!project) return socket.emit('error', { message: 'Access denied' });
        socket.join(`project:${id}`);
      } else if (type === 'company') {
        const user = await User.findById(socket.userId);
        if (!user || user.company.toString() !== id) return socket.emit('error', { message: 'Access denied' });
        socket.join(`company:${id}`);
      }

      console.log(`User ${socket.userId} joined ${type}:${id}`);
    } catch (error) {
      console.error('Error joining room:', error);
    }
  });

  // Legacy support for join-project
  socket.on('join-project', (projectId) => {
    socket.join(`project:${projectId}`);
  });

  // Leave a room
  socket.on('leave-room', (data) => {
    const { type, id } = data;
    socket.leave(`${type}:${id}`);
    console.log(`User ${socket.userId} left ${type}:${id}`);
  });

  // Legacy support for leave-project
  socket.on('leave-project', (projectId) => {
    socket.leave(`project:${projectId}`);
  });

  // Send a message
  socket.on('send-message', async (data) => {
    try {
      const { projectId, companyId, recipientId, content, mentions = [], replyTo } = data;

      const messageData = {
        sender: socket.userId,
        content,
        mentions,
        replyTo,
        type: 'text'
      };

      let targetRoom = '';
      let notificationTargets = [];

      if (projectId) {
        const project = await Project.findOne({
          _id: projectId,
          $or: [{ owner: socket.userId }, { 'members.user': socket.userId }]
        });
        if (!project) return socket.emit('error', { message: 'Access denied' });
        messageData.project = projectId;
        targetRoom = `project:${projectId}`;
        notificationTargets = [project.owner.toString(), ...project.members.map(m => m.user.toString())];
      } else if (companyId) {
        const user = await User.findById(socket.userId);
        if (!user || user.company.toString() !== companyId) return socket.emit('error', { message: 'Access denied' });
        messageData.company = companyId;
        targetRoom = `company:${companyId}`;
        // For company, we might not want to notify everyone, or use a different mechanism
      } else if (recipientId) {
        messageData.recipient = recipientId;
        const msg = await Message.create(messageData);
        await msg.populate('sender', 'name email profile.profilePicture');
        await msg.populate('recipient', 'name email profile.profilePicture');
        io.to(`user:${recipientId}`).emit('new-message', msg);
        io.to(`user:${socket.userId}`).emit('new-message', msg);
        return;
      }

      const message = await Message.create(messageData);
      await message.populate('sender', 'name email profile.profilePicture');
      await message.populate('mentions', 'name email');
      if (replyTo) await message.populate('replyTo', 'content sender');

      io.to(targetRoom).emit('new-message', message);

      // Handle notifications
      if (projectId) {
        notificationTargets.forEach(memberId => {
          if (memberId !== socket.userId) {
            io.to(`user:${memberId}`).emit('chat-notification', {
              projectId,
              messageId: message._id,
              senderName: message.sender.name,
              content: content.substring(0, 50)
            });
          }
        });
      }
    } catch (error) {
      console.error('Error sending message:', error);
      socket.emit('error', { message: 'Failed to send message' });
    }
  });

  // Typing indicator
  socket.on('typing', async (data) => {
    const { projectId, companyId, recipientId, isTyping } = data;
    const user = await User.findById(socket.userId).select('name');
    const payload = { userId: socket.userId, userName: user?.name, isTyping };

    if (projectId) socket.to(`project:${projectId}`).emit('user-typing', payload);
    else if (companyId) socket.to(`company:${companyId}`).emit('user-typing', payload);
    else if (recipientId) socket.to(`user:${recipientId}`).emit('user-typing', payload);
  });

  // Mark messages as read
  socket.on('mark-read', async (data) => {
    const { projectId, companyId, dmWithId, messageIds } = data;
    try {
      const query = { _id: { $in: messageIds } };
      if (projectId) query.project = projectId;
      else if (companyId) query.company = companyId;
      else if (dmWithId) {
        query.$or = [
          { sender: socket.userId, recipient: dmWithId },
          { sender: dmWithId, recipient: socket.userId }
        ];
      }

      await Message.updateMany(query, {
        $addToSet: { readBy: { user: socket.userId, readAt: new Date() } }
      });
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.userId}`);
  });
});

// Serve React app for all non-API routes
if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  });
}

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log('Socket.io enabled for real-time chat');
  console.log('File upload limit: 10MB');
});