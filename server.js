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

  // Join user to their own room for private notifications
  socket.join(`user:${socket.userId}`);

  // Join a project chat room
  socket.on('join-project', async (projectId) => {
    try {
      // Verify user has access to this project
      const project = await Project.findOne({
        _id: projectId,
        $or: [
          { owner: socket.userId },
          { 'members.user': socket.userId }
        ]
      });

      if (!project) {
        socket.emit('error', { message: 'Access denied to this project' });
        return;
      }

      socket.join(`project:${projectId}`);
      console.log(`User ${socket.userId} joined project:${projectId}`);

      // Notify others in the room
      const user = await User.findById(socket.userId).select('name profile.profilePicture');
      socket.to(`project:${projectId}`).emit('user-joined', {
        userId: socket.userId,
        userName: user?.name,
        avatar: user?.profile?.profilePicture
      });
    } catch (error) {
      console.error('Error joining project:', error);
      socket.emit('error', { message: 'Failed to join project chat' });
    }
  });

  // Leave a project chat room
  socket.on('leave-project', (projectId) => {
    socket.leave(`project:${projectId}`);
    console.log(`User ${socket.userId} left project:${projectId}`);
  });

  // Send a message
  socket.on('send-message', async (data) => {
    try {
      const { projectId, content, mentions = [], replyTo } = data;

      // Verify user has access
      const project = await Project.findOne({
        _id: projectId,
        $or: [
          { owner: socket.userId },
          { 'members.user': socket.userId }
        ]
      });

      if (!project) {
        socket.emit('error', { message: 'Access denied' });
        return;
      }

      // Create message
      const message = await Message.create({
        project: projectId,
        sender: socket.userId,
        content,
        mentions,
        replyTo,
        type: 'text'
      });

      // Populate sender and mentions
      await message.populate('sender', 'name email profile.profilePicture');
      await message.populate('mentions', 'name email');
      if (replyTo) {
        await message.populate('replyTo', 'content sender');
      }

      // Emit to all users in the project room
      io.to(`project:${projectId}`).emit('new-message', message);

      // Send chat notification to all project members (for unread counter)
      // Get all project members
      const projectMembers = [project.owner.toString(), ...project.members.map(m => m.user.toString())];

      // Send notification to each member's personal room (excluding the sender)
      projectMembers.forEach(memberId => {
        if (memberId !== socket.userId) {
          io.to(`user:${memberId}`).emit('chat-notification', {
            projectId,
            projectTitle: project.title,
            messageId: message._id,
            senderId: socket.userId,
            senderName: message.sender.name,
            content: content.substring(0, 50) + (content.length > 50 ? '...' : ''),
            timestamp: message.createdAt
          });
        }
      });

      // Send notifications to mentioned users
      mentions.forEach(userId => {
        io.to(`user:${userId}`).emit('mention-notification', {
          projectId,
          projectTitle: project.title,
          messageId: message._id,
          senderName: message.sender.name
        });
      });
    } catch (error) {
      console.error('Error sending message:', error);
      socket.emit('error', { message: 'Failed to send message' });
    }
  });

  // Typing indicator
  socket.on('typing', async (data) => {
    const { projectId, isTyping } = data;
    const user = await User.findById(socket.userId).select('name');
    socket.to(`project:${projectId}`).emit('user-typing', {
      userId: socket.userId,
      userName: user?.name,
      isTyping
    });
  });

  // Mark messages as read
  socket.on('mark-read', async (data) => {
    const { projectId, messageIds } = data;
    try {
      await Message.updateMany(
        { _id: { $in: messageIds }, project: projectId },
        { $addToSet: { readBy: { user: socket.userId, readAt: new Date() } } }
      );
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