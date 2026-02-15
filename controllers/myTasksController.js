const Task = require('../models/Task');
const TaskUserDuration = require('../models/TaskUserDuration');
const TaskActivity = require('../models/TaskActivity');
const Project = require('../models/Project');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { validationResult } = require('express-validator');

// Get all tasks assigned to logged-in user
exports.getMyTasks = async (req, res) => {
  try {
    const userId = req.user._id;

    // Find all tasks where user is in roleAssignments OR regular assignees
    // Priority: tasks with roleAssignments (workflow tasks)
    const tasks = await Task.find({
      $or: [
        { 'roleAssignments.assignees': userId },
        { assignees: userId }
      ]
    })
      .populate('project', 'title')
      .populate('status', 'name color')
      .populate('roleAssignments.role', 'name color icon')
      .populate('roleAssignments.assignees', 'name email')
      .populate('assignees', 'name email')
      .select('title description status project roleAssignments currentRoleIndex useRoleWorkflow assignees createdAt updatedAt')
      .sort({ updatedAt: -1 });

    console.log(`[getMyTasks] Found ${tasks.length} tasks for user ${userId}`);

    // Filter and format tasks with user's step info
    const myTasks = tasks.map(task => {
      // Check if user is in roleAssignments (workflow tasks)
      const userStepIndex = task.roleAssignments ? task.roleAssignments.findIndex(ra => {
        if (!ra || !ra.assignees || !Array.isArray(ra.assignees)) return false;
        return ra.assignees.some(a => {
          const assigneeId = a._id ? a._id.toString() : (a.toString ? a.toString() : String(a));
          return assigneeId === userId.toString();
        });
      }) : -1;

      // If user is in roleAssignments, return workflow task info
      // Show task if it has roleAssignments (even if useRoleWorkflow is false, as it might be set up)
      if (userStepIndex !== -1 && task.roleAssignments && task.roleAssignments.length > 0) {
        const userStep = task.roleAssignments[userStepIndex];
        const isCurrentStep = task.currentRoleIndex === userStepIndex;
        const isPreviousStep = task.currentRoleIndex > userStepIndex;
        const isNextStep = task.currentRoleIndex < userStepIndex;

        // Check eligibility to start
        let canStart = false;
        if (isCurrentStep && (userStep.status === 'pending' || userStep.status === 'blocked')) {
          // Check if previous step is completed
          if (userStepIndex === 0) {
            canStart = true; // First step can always start
          } else {
            const previousStep = task.roleAssignments[userStepIndex - 1];
            canStart = previousStep.status === 'completed' || previousStep.status === 'skipped';
          }
        }

        return {
          _id: task._id,
          title: task.title,
          description: task.description,
          project: task.project,
          status: task.status,
          userStep: {
            stepOrder: userStep.order,
            role: userStep.role,
            status: userStep.status,
            isCurrent: isCurrentStep,
            isPrevious: isPreviousStep,
            isNext: isNextStep
          },
          canStart,
          useRoleWorkflow: true,
          createdAt: task.createdAt,
          updatedAt: task.updatedAt
        };
      }

      // If user is in regular assignees but not in role workflow, still show the task
      const isInRegularAssignees = task.assignees && Array.isArray(task.assignees) && task.assignees.some(a => {
        if (!a) return false;
        const assigneeId = a._id ? a._id.toString() : (a.toString ? a.toString() : String(a));
        return assigneeId === userId.toString();
      });

      if (isInRegularAssignees) {
        return {
          _id: task._id,
          title: task.title,
          description: task.description,
          project: task.project,
          status: task.status,
          userStep: {
            stepOrder: null,
            role: null,
            status: 'assigned',
            isCurrent: false,
            isPrevious: false,
            isNext: false
          },
          canStart: false,
          useRoleWorkflow: task.useRoleWorkflow || false,
          createdAt: task.createdAt,
          updatedAt: task.updatedAt
        };
      }

      return null;
    }).filter(task => task !== null);

    console.log(`[getMyTasks] Returning ${myTasks.length} formatted tasks`);
    res.json(myTasks);
  } catch (error) {
    console.error('Error fetching my tasks:', error);
    res.status(500).json({ error: error.message });
  }
};

// Get single task with full details for My Tasks view
exports.getMyTaskDetails = async (req, res) => {
  try {
    const { taskId } = req.params;
    const userId = req.user._id;

    const task = await Task.findById(taskId)
      .populate('project', 'title')
      .populate('status', 'name color')
      .populate('roleAssignments.role', 'name color icon order')
      .populate('roleAssignments.assignees', 'name email profile')
      .populate('roleAssignments.handoff.handoffBy', 'name email')
      .populate('createdBy', 'name email');

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Check if user is in workflow
    const userStepIndex = task.roleAssignments.findIndex(ra =>
      ra.assignees.some(a => a.toString() === userId.toString())
    );

    if (userStepIndex === -1) {
      return res.status(403).json({ error: 'You are not assigned to this task' });
    }

    // Partition steps into previous/current/next
    const previousSteps = task.roleAssignments.slice(0, userStepIndex);
    const currentStep = task.roleAssignments[userStepIndex];
    const nextSteps = task.roleAssignments.slice(userStepIndex + 1);

    // Get user's duration for this task/step
    const userDuration = await TaskUserDuration.findOne({
      task: taskId,
      taskStep: currentStep._id,
      user: userId
    });

    // Calculate total duration (sum of all user durations for this task)
    const allDurations = await TaskUserDuration.find({ task: taskId });
    const totalDurationMinutes = allDurations.reduce((sum, d) => sum + (d.durationMinutes || 0), 0);

    // Get activity/timeline
    const activities = await TaskActivity.find({ task: taskId })
      .populate('performedBy', 'name email profile')
      .populate('sentBackTo', 'name email')
      .sort({ createdAt: -1 });

    // Check eligibility
    let canStart = false;
    let canComplete = false;
    let canSetDuration = true;
    let canSendBack = false;

    if (task.currentRoleIndex === userStepIndex) {
      // User is in current step
      if (currentStep.status === 'pending' || currentStep.status === 'blocked') {
        // Check if previous step is completed
        if (userStepIndex === 0) {
          canStart = true;
        } else {
          const previousStep = task.roleAssignments[userStepIndex - 1];
          canStart = previousStep.status === 'completed' || previousStep.status === 'skipped';
        }
      } else if (currentStep.status === 'active' || currentStep.status === 'in_progress') {
        canComplete = true;
        canSetDuration = true;
      }

      // Can send back if current step is active/in_progress and previous step exists and is completed
      if ((currentStep.status === 'active' || currentStep.status === 'in_progress') && userStepIndex > 0) {
        const previousStep = task.roleAssignments[userStepIndex - 1];
        if (previousStep.status === 'completed') {
          canSendBack = true;
        }
      }
    } else if (userStepIndex < task.currentRoleIndex) {
      // User is in a previous step - can still set duration
      canSetDuration = true;
    }

    res.json({
      task: {
        _id: task._id,
        title: task.title,
        description: task.description,
        project: task.project,
        status: task.status,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt
      },
      steps: {
        previous: previousSteps.map(step => ({
          _id: step._id,
          order: step.order,
          role: step.role,
          assignees: step.assignees,
          status: step.status,
          startedAt: step.startedAt,
          completedAt: step.completedAt,
          handoff: step.handoff
        })),
        current: {
          _id: currentStep._id,
          order: currentStep.order,
          role: currentStep.role,
          assignees: currentStep.assignees,
          status: currentStep.status,
          startedAt: currentStep.startedAt,
          completedAt: currentStep.completedAt,
          handoff: currentStep.handoff
        },
        next: nextSteps.map(step => ({
          _id: step._id,
          order: step.order,
          role: step.role,
          assignees: step.assignees,
          status: step.status,
          startedAt: step.startedAt,
          completedAt: step.completedAt
        }))
      },
      duration: {
        userDurationMinutes: userDuration?.durationMinutes || null,
        totalDurationMinutes: totalDurationMinutes
      },
      allowedActions: {
        canStart,
        canComplete,
        canSetDuration,
        canSendBack
      },
      activity: activities
    });
  } catch (error) {
    console.error('Error fetching task details:', error);
    res.status(500).json({ error: error.message });
  }
};

// Set/update user's duration for a task step
exports.setDuration = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { taskId } = req.params;
    const { duration_minutes } = req.body;
    const userId = req.user._id;

    if (!duration_minutes || duration_minutes < 0) {
      return res.status(400).json({ error: 'Duration must be a positive number' });
    }

    const task = await Task.findById(taskId);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Find user's step
    const userStepIndex = task.roleAssignments.findIndex(ra =>
      ra.assignees.some(a => a.toString() === userId.toString())
    );

    if (userStepIndex === -1) {
      return res.status(403).json({ error: 'You are not assigned to this task' });
    }

    const userStep = task.roleAssignments[userStepIndex];

    // Upsert duration
    const duration = await TaskUserDuration.findOneAndUpdate(
      {
        task: taskId,
        taskStep: userStep._id,
        user: userId
      },
      {
        task: taskId,
        taskStep: userStep._id,
        user: userId,
        durationMinutes: duration_minutes
      },
      {
        upsert: true,
        new: true
      }
    );

    // Create activity entry
    await TaskActivity.create({
      task: taskId,
      taskStep: userStep._id,
      action: 'duration_updated',
      performedBy: userId,
      metadata: {
        durationMinutes: duration_minutes,
        previousDuration: null // Could track previous if needed
      }
    });

    // Calculate total duration
    const allDurations = await TaskUserDuration.find({ task: taskId });
    const totalDurationMinutes = allDurations.reduce((sum, d) => sum + (d.durationMinutes || 0), 0);

    res.json({
      userDurationMinutes: duration.durationMinutes,
      totalDurationMinutes
    });
  } catch (error) {
    console.error('Error setting duration:', error);
    res.status(500).json({ error: error.message });
  }
};

// Start task step (mark as in_progress)
exports.startTask = async (req, res) => {
  try {
    const { taskId } = req.params;
    const userId = req.user._id;

    const task = await Task.findById(taskId);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    if (!task.useRoleWorkflow) {
      return res.status(400).json({ error: 'Task does not use role workflow' });
    }

    // Find user's step
    const userStepIndex = task.roleAssignments.findIndex(ra =>
      ra.assignees.some(a => a.toString() === userId.toString())
    );

    if (userStepIndex === -1) {
      return res.status(403).json({ error: 'You are not assigned to this task' });
    }

    const userStep = task.roleAssignments[userStepIndex];

    // Check eligibility
    if (task.currentRoleIndex !== userStepIndex) {
      return res.status(400).json({ error: 'This is not your current step' });
    }

    if (userStep.status === 'completed') {
      return res.status(400).json({ error: 'Step is already completed' });
    }

    // Check if previous step is completed (if not first step)
    if (userStepIndex > 0) {
      const previousStep = task.roleAssignments[userStepIndex - 1];
      if (previousStep.status !== 'completed' && previousStep.status !== 'skipped') {
        return res.status(400).json({ error: 'Previous step must be completed first' });
      }
    }

    // Start the step (idempotent - safe if already started)
    if (userStep.status === 'pending' || userStep.status === 'blocked') {
      userStep.status = 'active'; // Use 'active' to match existing workflow pattern
      if (!userStep.startedAt) {
        userStep.startedAt = new Date();
      }

      await task.save();

      // Create activity entry
      await TaskActivity.create({
        task: taskId,
        taskStep: userStep._id,
        action: 'started',
        performedBy: userId
      });
    }

    await task.populate('roleAssignments.role', 'name color icon');
    await task.populate('roleAssignments.assignees', 'name email profile');

    res.json({
      message: 'Task step started',
      step: {
        _id: userStep._id,
        order: userStep.order,
        role: userStep.role,
        assignees: userStep.assignees,
        status: userStep.status,
        startedAt: userStep.startedAt
      }
    });
  } catch (error) {
    console.error('Error starting task:', error);
    res.status(500).json({ error: error.message });
  }
};

// Complete task step
exports.completeTask = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { taskId } = req.params;
    const { note } = req.body;
    const userId = req.user._id;

    if (!note || note.trim().length === 0) {
      return res.status(400).json({ error: 'Completion note is required' });
    }

    const task = await Task.findById(taskId);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Find user's step
    const userStepIndex = task.roleAssignments.findIndex(ra =>
      ra.assignees.some(a => a.toString() === userId.toString())
    );

    if (userStepIndex === -1) {
      return res.status(403).json({ error: 'You are not assigned to this task' });
    }

    const userStep = task.roleAssignments[userStepIndex];

    // Check eligibility
    if (task.currentRoleIndex !== userStepIndex) {
      return res.status(400).json({ error: 'This is not your current step' });
    }

    if (userStep.status !== 'active' && userStep.status !== 'in_progress') {
      return res.status(400).json({ error: 'Step must be started before completion' });
    }

    // Handle file uploads
    let documents = [];
    if (req.files && req.files.length > 0) {
      documents = req.files.map(file => ({
        filename: file.filename,
        originalName: file.originalname,
        path: file.path,
        size: file.size,
        uploadedAt: new Date()
      }));
    }

    // Complete the step
    userStep.status = 'completed';
    userStep.completedAt = new Date();

    // Move to next step if exists
    const nextStepIndex = userStepIndex + 1;
    if (nextStepIndex < task.roleAssignments.length) {
      task.currentRoleIndex = nextStepIndex;
      const nextStep = task.roleAssignments[nextStepIndex];
      // Unblock next step if it was blocked
      if (nextStep.status === 'blocked') {
        nextStep.status = 'pending';
      }
      // Activate next step
      if (nextStep.status === 'pending') {
        nextStep.status = 'active';
        nextStep.startedAt = new Date();
      }
    }

    await task.save();

    // Create activity entry
    const activity = await TaskActivity.create({
      task: taskId,
      taskStep: userStep._id,
      action: 'completed',
      performedBy: userId,
      note: note.trim(),
      documents: documents
    });

    // Notify next step assignees if exists
    if (nextStepIndex < task.roleAssignments.length) {
      const nextStep = task.roleAssignments[nextStepIndex];
      for (const assignee of nextStep.assignees) {
        const notification = new Notification({
          user: assignee._id,
          type: 'task_role_handoff',
          title: `Task ready: ${task.title}`,
          message: `The previous step has been completed. Task "${task.title}" is now ready for your role.`,
          relatedId: task._id,
          relatedModel: 'Task',
          metadata: {
            taskId: task._id,
            stepOrder: nextStep.order,
            roleId: nextStep.role._id || nextStep.role
          }
        });
        await notification.save();
      }
    }

    await activity.populate('performedBy', 'name email profile');

    res.json({
      message: 'Task step completed',
      activity: activity,
      nextStepActivated: nextStepIndex < task.roleAssignments.length
    });
  } catch (error) {
    console.error('Error completing task:', error);
    res.status(500).json({ error: error.message });
  }
};

// Send back for fix
exports.sendBackForFix = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { taskId } = req.params;
    const { note, message } = req.body;
    const userId = req.user._id;

    if (!note || note.trim().length === 0) {
      return res.status(400).json({ error: 'Note is required' });
    }

    const task = await Task.findById(taskId);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Find user's step
    const userStepIndex = task.roleAssignments.findIndex(ra =>
      ra.assignees.some(a => a.toString() === userId.toString())
    );

    if (userStepIndex === -1) {
      return res.status(403).json({ error: 'You are not assigned to this task' });
    }

    const userStep = task.roleAssignments[userStepIndex];

    // Check eligibility - must be current step and previous step must exist and be completed
    if (task.currentRoleIndex !== userStepIndex) {
      return res.status(400).json({ error: 'This is not your current step' });
    }

    if (userStepIndex === 0) {
      return res.status(400).json({ error: 'Cannot send back from first step' });
    }

    const previousStep = task.roleAssignments[userStepIndex - 1];
    if (previousStep.status !== 'completed') {
      return res.status(400).json({ error: 'Previous step must be completed to send back' });
    }

    // Get previous step assignees for notification
    await task.populate('roleAssignments.assignees', 'name email');

    // Transaction-like operations
    // 1. Mark previous step as needs_changes
    previousStep.status = 'needs_changes';

    // 2. Block current step
    userStep.status = 'blocked';

    // 3. Create activity entry
    const previousAssignee = previousStep.assignees[0]; // Get first assignee for notification
    const professionalMessage = message || `Hi ${previousAssignee?.name || 'there'}, I reviewed the task submission and found a few items that need adjustment: ${note}. Could you please address these and re-submit? Thanks.`;

    const activity = await TaskActivity.create({
      task: taskId,
      taskStep: previousStep._id,
      action: 'send_back',
      performedBy: userId,
      note: note.trim(),
      message: professionalMessage,
      sentBackTo: previousAssignee?._id || previousStep.assignees[0]
    });

    // 4. Create notifications for previous step assignees
    for (const assignee of previousStep.assignees) {
      const notification = new Notification({
        user: assignee._id,
        type: 'task_send_back',
        title: `Task needs changes: ${task.title}`,
        message: professionalMessage,
        relatedId: task._id,
        relatedModel: 'Task',
        metadata: {
          taskId: task._id,
          stepOrder: previousStep.order,
          sentBackBy: userId,
          note: note.trim()
        }
      });
      await notification.save();
    }

    await task.save();
    await activity.populate('performedBy', 'name email profile');
    await activity.populate('sentBackTo', 'name email');

    res.json({
      message: 'Task sent back for fix',
      activity: activity,
      previousStepStatus: previousStep.status,
      currentStepStatus: userStep.status
    });
  } catch (error) {
    console.error('Error sending back task:', error);
    res.status(500).json({ error: error.message });
  }
};

