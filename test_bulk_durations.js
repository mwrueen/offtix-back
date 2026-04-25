const mongoose = require('mongoose');
const Task = require('./models/Task');
const TaskUserDuration = require('./models/TaskUserDuration');
const TaskRole = require('./models/TaskRole');
const taskController = require('./controllers/taskController');

mongoose.connect('mongodb://localhost:27017/tabredon').then(async () => {
  const req = {
    params: { projectId: '69e2826a038e09f2e7359257' },
    query: { 
      userId: '69e28963038e09f2e735b4a8', 
      roleId: '69e2879a038e09f2e735acd1' 
    }
  };
  const res = {
    json: (data) => {
      console.log('RESULT:', JSON.stringify(data, null, 2));
      process.exit();
    },
    status: (code) => ({
      json: (data) => {
        console.log('ERROR:', code, JSON.stringify(data, null, 2));
        process.exit();
      }
    })
  };

  try {
    await taskController.getBulkUserDurations(req, res);
  } catch (err) {
    console.error('CRASH:', err);
    process.exit(1);
  }
});
