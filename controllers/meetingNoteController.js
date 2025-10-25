const MeetingNote = require('../models/MeetingNote');
const Project = require('../models/Project');
const { validationResult } = require('express-validator');

exports.getMeetingNotes = async (req, res) => {
  try {
    const { projectId } = req.params;
    
    // Verify project access
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    const hasAccess = project.owner.equals(req.user._id) || 
                     project.members.some(member => member.equals(req.user._id));
    
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const meetingNotes = await MeetingNote.find({ project: projectId })
      .populate('organizer', 'name email')
      .populate('attendees.user', 'name email')
      .populate('agenda.presenter', 'name email')
      .populate('actionItems.assignedTo', 'name email')
      .populate('decisions.decidedBy', 'name email')
      .sort({ meetingDate: -1 });
    
    res.json(meetingNotes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.createMeetingNote = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { projectId } = req.params;
    
    // Verify project access
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    const hasAccess = project.owner.equals(req.user._id) || 
                     project.members.some(member => member.equals(req.user._id));
    
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const meetingNote = new MeetingNote({
      ...req.body,
      project: projectId,
      organizer: req.user._id
    });
    
    await meetingNote.save();
    await meetingNote.populate('organizer', 'name email');
    await meetingNote.populate('attendees.user', 'name email');
    
    res.status(201).json(meetingNote);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.updateMeetingNote = async (req, res) => {
  try {
    const { projectId, meetingId } = req.params;
    
    const meetingNote = await MeetingNote.findOne({ _id: meetingId, project: projectId });
    
    if (!meetingNote) {
      return res.status(404).json({ error: 'Meeting note not found' });
    }

    // Verify project access
    const project = await Project.findById(projectId);
    const hasAccess = project.owner.equals(req.user._id) || 
                     project.members.some(member => member.equals(req.user._id));
    
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    Object.assign(meetingNote, req.body);
    await meetingNote.save();
    await meetingNote.populate('organizer', 'name email');
    await meetingNote.populate('attendees.user', 'name email');
    
    res.json(meetingNote);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.deleteMeetingNote = async (req, res) => {
  try {
    const { projectId, meetingId } = req.params;
    
    const meetingNote = await MeetingNote.findOne({ _id: meetingId, project: projectId });
    
    if (!meetingNote) {
      return res.status(404).json({ error: 'Meeting note not found' });
    }

    // Verify project access
    const project = await Project.findById(projectId);
    const hasAccess = project.owner.equals(req.user._id) || 
                     project.members.some(member => member.equals(req.user._id));
    
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await MeetingNote.findByIdAndDelete(meetingId);
    res.json({ message: 'Meeting note deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};