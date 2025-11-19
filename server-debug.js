const express = require('express');
const cors = require('cors');
require('dotenv').config();

console.log('Starting server...');

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

console.log('Middleware loaded');

// Try to connect to database
try {
  const { connectDatabase } = require('./config/database');
  connectDatabase().then(() => {
    console.log('Database connected successfully');
  }).catch(err => {
    console.error('Database connection failed:', err);
  });
} catch (err) {
  console.error('Error loading database config:', err);
}

// Basic health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'Server running' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});