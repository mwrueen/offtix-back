const { connectDatabase } = require('./config/database');
const mongoose = require('mongoose');
require('dotenv').config();

console.log("Checking DB connection and test...");
