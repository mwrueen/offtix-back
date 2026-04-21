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
    const companyId = req.headers['x-company-id'] || req.query.companyId || null;

    const projectFilter = companyId
      ? { company: companyId }
      : { $or: [{ company: { $exists: false } }, { company: null }] };

    const allowedProjects = await Project.find(projectFilter).select('_id').lean();
    const allowedProjectIds = allowedProjects.map(p => p._id);
    const allowedProjectIdSet = new Set(allowedProjectIds.map(id => id.toString()));

    // Find all tasks where user is in sequentialAssignees, roleAssignments OR regular assignees
    const tasks = await Task.find({
      $or: [
        { 'sequentialAssignees.user': userId },
        { 'roleAssignments.assignees': userId },
        { assignees: userId }
      ],
      project: { $in: allowedProjectIds }
    })
      .populate('project', 'title company')
      .populate('status', 'name color')
      .populate('roleAssignments.role', 'name color icon')
      .populate('roleAssignments.assignees', 'name email')
      .populate('sequentialAssignees.user', 'name email')
      .populate('assignees', 'name email')
      .select('title description status project roleAssignments currentRoleIndex useRoleWorkflow sequentialAssignees currentAssigneeIndex useSequentialWorkflow assignees priority createdAt updatedAt')
      .sort({ updatedAt: -1 });

    const scopedTasks = tasks.filter(t => {
      const pid = t.project?._id?.toString();
      return pid && allowedProjectIdSet.has(pid);
    });

    console.log(`[getMyTasks] Found ${scopedTasks.length} tasks for user ${userId} (companyId=${companyId || 'personal'})`);

    // Check if user has any task in progress
    const hasTaskInProgress = scopedTasks.some(task => {
      // Check sequential workflow
      if (task.useSequentialWorkflow && task.sequentialAssignees && task.sequentialAssignees.length > 0) {
        const userAssignee = task.sequentialAssignees.find(sa => {
          const assigneeUserId = sa.user._id ? sa.user._id.toString() : sa.user.toString();
          return assigneeUserId === userId.toString();
        });
        if (userAssignee && userAssignee.status === 'in_progress') {
          return true;
        }
      }
      // Check role workflow
      if (task.roleAssignments && task.roleAssignments.length > 0) {
        const userStep = task.roleAssignments.find(ra => {
          if (!ra || !ra.assignees || !Array.isArray(ra.assignees)) return false;
          return ra.assignees.some(a => {
            const assigneeId = a._id ? a._id.toString() : (a.toString ? a.toString() : String(a));
            return assigneeId === userId.toString();
          });
        });
        if (userStep && (userStep.status === 'active' || userStep.status === 'in_progress')) {
          return true;
        }
      }
      return false;
    });

    // Filter and format tasks with user's step info
    const myTasks = scopedTasks.map(task => {
      // Priority 1: Check if user is in sequentialAssignees (simple sequential workflow)
      if (task.useSequentialWorkflow && task.sequentialAssignees && task.sequentialAssignees.length > 0) {
        const userAssigneeIndex = task.sequentialAssignees.findIndex(sa => {
          const assigneeUserId = sa.user._id ? sa.user._id.toString() : sa.user.toString();
          return assigneeUserId === userId.toString();
        });

        if (userAssigneeIndex !== -1) {
          const userAssignee = task.sequentialAssignees[userAssigneeIndex];
          const isCurrentAssignee = task.currentAssigneeIndex === userAssigneeIndex;
          const isPreviousAssignee = task.currentAssigneeIndex > userAssigneeIndex;
          const isNextAssignee = task.currentAssigneeIndex < userAssigneeIndex;

          return {
            _id: task._id,
            title: task.title,
            description: task.description,
            project: task.project,
            status: task.status,
            priority: task.priority,
            workflowType: 'sequential',
            userAssignee: {
              order: userAssignee.order,
              status: userAssignee.status,
              isCurrent: isCurrentAssignee,
              isPrevious: isPreviousAssignee,
              isNext: isNextAssignee,
              startedAt: userAssignee.startedAt,
              pausedAt: userAssignee.pausedAt,
              completedAt: userAssignee.completedAt
            },
            canStart: isCurrentAssignee && !hasTaskInProgress && (userAssignee.status === 'pending' || userAssignee.status === 'active' || userAssignee.status === 'paused'),
            createdAt: task.createdAt,
            updatedAt: task.updatedAt
          };
        }
      }

      // Priority 2: Check if user is in roleAssignments (workflow tasks)
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
          priority: task.priority,
          workflowType: 'role',
          userStep: {
            stepOrder: userStep.order,
            role: userStep.role,
            status: userStep.status,
            isCurrent: isCurrentStep,
            isPrevious: isPreviousStep,
            isNext: isNextStep
          },
          canStart: canStart && !hasTaskInProgress,
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
          priority: task.priority,
          workflowType: 'regular',
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
    const companyId = req.headers['x-company-id'] || req.query.companyId || null;

    const task = await Task.findById(taskId)
      .populate('project', 'title company')
      .populate('status', 'name color')
      .populate('roleAssignments.role', 'name color icon order')
      .populate('roleAssignments.assignees', 'name email profile')
      .populate('roleAssignments.handoff.handoffBy', 'name email')
      .populate('sequentialAssignees.user', 'name email profile')
      .populate('assignees', 'name email profile')
      .populate('createdBy', 'name email');

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const taskCompany = task.project?.company ? task.project.company.toString() : null;
    // We do not enforce strict companyId matching here anymore.
    // If the user navigated from a notification or global task list without a company context,
    // they should still load the task. Authorization is handled below by checking if they are assigned.

    // Check if user has any other task in progress
    const tasksInProgress = await Task.find({
      $or: [
        { 'roleAssignments.assignees': userId, 'roleAssignments.status': { $in: ['active', 'in_progress'] } },
        { 'sequentialAssignees.user': userId, 'sequentialAssignees.status': 'in_progress' }
      ],
      _id: { $ne: taskId } // Exclude current task
    });

    const hasOtherTaskInProgress = tasksInProgress.length > 0;

    const subtasks = await Task.find({ parent: taskId })
      .populate('status', 'name slug color isDefault isCompleted')
      .populate('roleAssignments.role', 'name icon color')
      .populate('roleAssignments.assignees', 'name email profile projectRole')
      .populate('assignees', 'name email profile')
      .sort('order');

    // Check if user is assigned to this task (sequential, role, or regular)
    let isAssigned = false;
    let workflowType = 'regular';

    // Check sequential workflow
    if (task.useSequentialWorkflow && task.sequentialAssignees && task.sequentialAssignees.length > 0) {
      const userAssigneeIndex = task.sequentialAssignees.findIndex(sa => {
        const assigneeUserId = sa.user._id ? sa.user._id.toString() : sa.user.toString();
        return assigneeUserId === userId.toString();
      });

      if (userAssigneeIndex !== -1) {
        isAssigned = true;
        workflowType = 'sequential';

        const userAssignee = task.sequentialAssignees[userAssigneeIndex];
        const isCurrentAssignee = task.currentAssigneeIndex === userAssigneeIndex;

        // Get activity/timeline
        const activities = await TaskActivity.find({ task: taskId })
          .populate('performedBy', 'name email profile')
          .sort({ createdAt: -1 });

        // Determine allowed actions
        const canStart = isCurrentAssignee && !hasOtherTaskInProgress && (userAssignee.status === 'pending' || userAssignee.status === 'active' || userAssignee.status === 'paused');
        const canPause = isCurrentAssignee && userAssignee.status === 'in_progress';
        const canComplete = isCurrentAssignee && (userAssignee.status === 'in_progress' || userAssignee.status === 'paused');
        const canSendBack = isCurrentAssignee && userAssigneeIndex > 0;

        return res.json({
          task: {
            _id: task._id,
            title: task.title,
            description: task.description,
            project: task.project,
            status: task.status,
            priority: task.priority,
            createdAt: task.createdAt,
            updatedAt: task.updatedAt
          },
          workflowType: 'sequential',
          sequentialAssignees: task.sequentialAssignees.map((sa, idx) => ({
            user: sa.user,
            order: sa.order,
            status: sa.status,
            isCurrent: idx === task.currentAssigneeIndex,
            startedAt: sa.startedAt,
            pausedAt: sa.pausedAt,
            completedAt: sa.completedAt
          })),
          currentAssigneeIndex: task.currentAssigneeIndex,
          userAssigneeIndex: userAssigneeIndex,
          allowedActions: {
            canStart,
            canPause,
            canComplete,
            canSendBack
          },
          activity: activities,
          subtasks
        });
      }
    }

    // Check role-based workflow
    if (task.roleAssignments && task.roleAssignments.length > 0) {
      const userStepIndex = task.roleAssignments.findIndex(ra =>
        ra.assignees.some(a => a.toString() === userId.toString())
      );

      if (userStepIndex !== -1) {
        isAssigned = true;
        workflowType = 'role';

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
              canStart = !hasOtherTaskInProgress;
            } else {
              const previousStep = task.roleAssignments[userStepIndex - 1];
              canStart = !hasOtherTaskInProgress && (previousStep.status === 'completed' || previousStep.status === 'skipped');
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

        return res.json({
          task: {
            _id: task._id,
            title: task.title,
            description: task.description,
            project: task.project,
            status: task.status,
            createdAt: task.createdAt,
            updatedAt: task.updatedAt
          },
          workflowType: 'role',
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
          activity: activities,
          subtasks
        });
      }
    }

    // Check regular assignees
    if (task.assignees && task.assignees.length > 0) {
      const isRegularAssignee = task.assignees.some(a => {
        const assigneeId = a._id ? a._id.toString() : a.toString();
        return assigneeId === userId.toString();
      });

      if (isRegularAssignee) {
        isAssigned = true;

        // Get activity/timeline
        const activities = await TaskActivity.find({ task: taskId })
          .populate('performedBy', 'name email profile')
          .sort({ createdAt: -1 });

        return res.json({
          task: {
            _id: task._id,
            title: task.title,
            description: task.description,
            project: task.project,
            status: task.status,
            priority: task.priority,
            assignees: task.assignees,
            createdAt: task.createdAt,
            updatedAt: task.updatedAt
          },
          workflowType: 'regular',
          allowedActions: {
            canStart: false,
            canComplete: false,
            canSetDuration: false
          },
          activity: activities,
          subtasks
        });
      }
    }

    // User is not assigned to this task
    if (!isAssigned) {
      return res.status(403).json({ error: 'You are not assigned to this task' });
    }

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

    // Check if user has any other task in progress
    const tasksInProgress = await Task.find({
      $or: [
        { 'roleAssignments.assignees': userId, 'roleAssignments.status': { $in: ['active', 'in_progress'] } },
        { 'sequentialAssignees.user': userId, 'sequentialAssignees.status': 'in_progress' }
      ],
      _id: { $ne: taskId } // Exclude current task
    });

    if (tasksInProgress.length > 0) {
      return res.status(400).json({ 
        error: 'You already have a task in progress. Please complete or pause it before starting a new task.' 
      });
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
      const proj = await Project.findById(task.project).select('company').lean();
      const companyId = proj?.company || undefined;
      const io = req.app.get('io');
      for (const assignee of nextStep.assignees) {
        const notification = new Notification({
          user: assignee._id,
          company: companyId,
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

        // 🔔 Real-time event
        if (io) {
          io.to(`user:${assignee._id}`).emit('task:role_handoff', {
            type: 'task_role_handoff',
            title: `Task ready: ${task.title}`,
            message: `The previous step has been completed. "${task.title}" is now ready for your role.`,
            taskId: task._id
          });
        }
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

    // 4. Create notifications for previous step assignees + real-time events
    const io = req.app.get('io');
    const proj = await Project.findById(task.project).select('company').lean();
    const companyId = proj?.company || undefined;
    for (const assignee of previousStep.assignees) {
      const notification = new Notification({
        user: assignee._id,
        company: companyId,
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

      // 🔔 Real-time event
      if (io) {
        io.to(`user:${assignee._id}`).emit('task:sent_back', {
          type: 'task_send_back',
          title: `Task needs changes: ${task.title}`,
          message: professionalMessage,
          taskId: task._id
        });
      }
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


// ============================================
// SEQUENTIAL WORKFLOW OPERATIONS
// ============================================

// Start sequential task (mark as in_progress)
exports.startSequentialTask = async (req, res) => {
  try {
    const { taskId } = req.params;
    const userId = req.user._id;

    const task = await Task.findById(taskId)
      .populate('sequentialAssignees.user', 'name email')
      .populate('project', 'title')
      .populate('status', 'name color');

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    if (!task.useSequentialWorkflow) {
      return res.status(400).json({ error: 'Task does not use sequential workflow' });
    }

    // Find user's assignee entry
    const userAssigneeIndex = task.sequentialAssignees.findIndex(sa =>
      sa.user._id.toString() === userId.toString()
    );

    if (userAssigneeIndex === -1) {
      return res.status(403).json({ error: 'You are not assigned to this task' });
    }

    const userAssignee = task.sequentialAssignees[userAssigneeIndex];

    // Check if it's user's turn
    if (task.currentAssigneeIndex !== userAssigneeIndex) {
      return res.status(400).json({ error: 'It is not your turn yet' });
    }

    // Check if already completed
    if (userAssignee.status === 'completed') {
      return res.status(400).json({ error: 'You have already completed this task' });
    }

    // Check if user has any other task in progress
    const tasksInProgress = await Task.find({
      $or: [
        { 'roleAssignments.assignees': userId, 'roleAssignments.status': { $in: ['active', 'in_progress'] } },
        { 'sequentialAssignees.user': userId, 'sequentialAssignees.status': 'in_progress' }
      ],
      _id: { $ne: taskId } // Exclude current task
    });

    if (tasksInProgress.length > 0) {
      return res.status(400).json({ 
        error: 'You already have a task in progress. Please complete or pause it before starting a new task.' 
      });
    }

    // Start the task
    if (userAssignee.status === 'pending' || userAssignee.status === 'active' || userAssignee.status === 'paused') {
      userAssignee.status = 'in_progress';
      if (!userAssignee.startedAt) {
        userAssignee.startedAt = new Date();
      }
      userAssignee.pausedAt = null;

      await task.save();

      // Create activity entry
      await TaskActivity.create({
        task: taskId,
        action: 'started',
        performedBy: userId,
        metadata: {
          assigneeOrder: userAssignee.order
        }
      });
    }

    res.json({
      message: 'Task started',
      task: {
        _id: task._id,
        title: task.title,
        status: task.status,
        currentAssignee: userAssignee
      }
    });
  } catch (error) {
    console.error('Error starting sequential task:', error);
    res.status(500).json({ error: error.message });
  }
};

// Pause sequential task
exports.pauseSequentialTask = async (req, res) => {
  try {
    const { taskId } = req.params;
    const userId = req.user._id;

    const task = await Task.findById(taskId)
      .populate('sequentialAssignees.user', 'name email');

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    if (!task.useSequentialWorkflow) {
      return res.status(400).json({ error: 'Task does not use sequential workflow' });
    }

    // Find user's assignee entry
    const userAssigneeIndex = task.sequentialAssignees.findIndex(sa =>
      sa.user._id.toString() === userId.toString()
    );

    if (userAssigneeIndex === -1) {
      return res.status(403).json({ error: 'You are not assigned to this task' });
    }

    const userAssignee = task.sequentialAssignees[userAssigneeIndex];

    // Check if it's user's turn
    if (task.currentAssigneeIndex !== userAssigneeIndex) {
      return res.status(400).json({ error: 'It is not your turn yet' });
    }

    // Check if in progress
    if (userAssignee.status !== 'in_progress') {
      return res.status(400).json({ error: 'Task must be in progress to pause' });
    }

    // Pause the task
    userAssignee.status = 'paused';
    userAssignee.pausedAt = new Date();

    await task.save();

    // Create activity entry
    await TaskActivity.create({
      task: taskId,
      action: 'paused',
      performedBy: userId,
      metadata: {
        assigneeOrder: userAssignee.order
      }
    });

    res.json({
      message: 'Task paused',
      task: {
        _id: task._id,
        title: task.title,
        currentAssignee: userAssignee
      }
    });
  } catch (error) {
    console.error('Error pausing sequential task:', error);
    res.status(500).json({ error: error.message });
  }
};

// Complete sequential task (move to next assignee)
exports.completeSequentialTask = async (req, res) => {
  try {
    const { taskId } = req.params;
    const userId = req.user._id;

    const task = await Task.findById(taskId)
      .populate('sequentialAssignees.user', 'name email')
      .populate('project', 'title')
      .populate('status', 'name color');

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    if (!task.useSequentialWorkflow) {
      return res.status(400).json({ error: 'Task does not use sequential workflow' });
    }

    // Find user's assignee entry
    const userAssigneeIndex = task.sequentialAssignees.findIndex(sa =>
      sa.user._id.toString() === userId.toString()
    );

    if (userAssigneeIndex === -1) {
      return res.status(403).json({ error: 'You are not assigned to this task' });
    }

    const userAssignee = task.sequentialAssignees[userAssigneeIndex];

    // Check if it's user's turn
    if (task.currentAssigneeIndex !== userAssigneeIndex) {
      return res.status(400).json({ error: 'It is not your turn yet' });
    }

    // Check if in progress
    if (userAssignee.status !== 'in_progress' && userAssignee.status !== 'paused') {
      return res.status(400).json({ error: 'Task must be started before completion' });
    }

    const { note, message, link } = req.body;

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

    // Complete current assignee's work
    userAssignee.status = 'completed';
    userAssignee.completedAt = new Date();

    // Move to next assignee if exists
    const nextAssigneeIndex = userAssigneeIndex + 1;
    let allCompleted = false;

    if (nextAssigneeIndex < task.sequentialAssignees.length) {
      // Activate next assignee
      task.currentAssigneeIndex = nextAssigneeIndex;
      const nextAssignee = task.sequentialAssignees[nextAssigneeIndex];
      nextAssignee.status = 'active';
      nextAssignee.startedAt = new Date();

      const proj = await Project.findById(task.project._id || task.project).select('company').lean();
      const companyId = proj?.company || undefined;
      // Notify next assignee via DB + socket
      const notification = new Notification({
        user: nextAssignee.user._id,
        company: companyId,
        type: 'task_ready',
        title: `Task ready: ${task.title}`,
        message: `The previous assignee has completed their work. Task "${task.title}" is now ready for you.`,
        relatedId: task._id,
        relatedModel: 'Task',
        metadata: {
          taskId: task._id,
          projectId: task.project._id
        }
      });
      await notification.save();

      // 🔔 Real-time socket event
      const io = req.app.get('io');
      if (io) {
        io.to(`user:${nextAssignee.user._id}`).emit('task:ready', {
          type: 'task_ready',
          title: `Task ready: ${task.title}`,
          message: `The previous assignee has completed their work. "${task.title}" is now ready for you.`,
          taskId: task._id,
          projectId: task.project._id
        });
      }
    } else {
      // All assignees completed - mark task as done
      allCompleted = true;

      // Find "Done" status for this project
      const TaskStatus = require('../models/TaskStatus');
      const doneStatus = await TaskStatus.findOne({
        project: task.project._id,
        name: { $regex: /^done$/i }
      });

      if (doneStatus) {
        task.status = doneStatus._id;
      }
    }

    await task.save();

    // Create activity entry
    await TaskActivity.create({
      task: taskId,
      action: 'completed',
      performedBy: userId,
      note: note ? note.trim() : '',
      message: message ? message.trim() : '',
      documents: documents,
      metadata: {
        assigneeOrder: userAssignee.order,
        allCompleted: allCompleted,
        link: link || null
      }
    });

    res.json({
      message: allCompleted ? 'Task fully completed' : 'Your part completed, moved to next assignee',
      task: {
        _id: task._id,
        title: task.title,
        status: task.status,
        allCompleted: allCompleted
      }
    });
  } catch (error) {
    console.error('Error completing sequential task:', error);
    res.status(500).json({ error: error.message });
  }
};

// Send back sequential task for fix
exports.sendBackSequentialTask = async (req, res) => {
  try {
    const { taskId } = req.params;
    const userId = req.user._id;

    const task = await Task.findById(taskId)
      .populate('sequentialAssignees.user', 'name email')
      .populate('project', 'title')
      .populate('status', 'name color');

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    if (!task.useSequentialWorkflow) {
      return res.status(400).json({ error: 'Task does not use sequential workflow' });
    }

    // Find user's assignee entry
    const userAssigneeIndex = task.sequentialAssignees.findIndex(sa =>
      sa.user._id.toString() === userId.toString()
    );

    if (userAssigneeIndex === -1) {
      return res.status(403).json({ error: 'You are not assigned to this task' });
    }

    const userAssignee = task.sequentialAssignees[userAssigneeIndex];

    // Check if it's user's turn
    if (task.currentAssigneeIndex !== userAssigneeIndex) {
      return res.status(400).json({ error: 'It is not your turn yet' });
    }

    if (userAssigneeIndex === 0) {
      return res.status(400).json({ error: 'Cannot send back from first step' });
    }

    const { note, message, link } = req.body;

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

    const previousAssigneeIndex = userAssigneeIndex - 1;
    const previousAssignee = task.sequentialAssignees[previousAssigneeIndex];

    // Process send-back
    userAssignee.status = 'pending';
    task.currentAssigneeIndex = previousAssigneeIndex;
    previousAssignee.status = 'in_progress';
    previousAssignee.completedAt = null;

    const professionalMessage = message || `Hi ${previousAssignee.user.name}, I reviewed the task and found some items that need adjustment: ${note || 'Please review.'}.`;

    // Create notification
    const proj = await Project.findById(task.project._id || task.project).select('company').lean();
    const companyId = proj?.company || undefined;
    const notification = new Notification({
      user: previousAssignee.user._id,
      company: companyId,
      type: 'task_send_back',
      title: `Task sent back: ${task.title}`,
      message: professionalMessage,
      relatedId: task._id,
      relatedModel: 'Task',
      metadata: {
        taskId: task._id,
        sentBackBy: userId,
        note: note ? note.trim() : ''
      }
    });

    await notification.save();

    // 🔔 Real-time socket event — notify previous assignee
    const io = req.app.get('io');
    if (io) {
      io.to(`user:${previousAssignee.user._id}`).emit('task:sent_back', {
        type: 'task_send_back',
        title: `Task sent back: ${task.title}`,
        message: professionalMessage,
        taskId: task._id
      });
    }

    await task.save();

    // Create activity entry
    await TaskActivity.create({
      task: taskId,
      action: 'send_back',
      performedBy: userId,
      note: note ? note.trim() : '',
      message: professionalMessage,
      documents: documents,
      sentBackTo: previousAssignee.user._id,
      metadata: {
        assigneeOrder: userAssignee.order,
        link: link || null
      }
    });

    res.json({
      message: 'Task sent back successfully',
      task: {
        _id: task._id,
        title: task.title,
        status: task.status
      }
    });
  } catch (error) {
    console.error('Error sending back sequential task:', error);
    res.status(500).json({ error: error.message });
  }
};
