const asyncHandler = require('../utils/asyncHandler');
const meetingNoteService = require('../services/meetingNoteService');

exports.getMeetingNotes = asyncHandler(async (req, res) => {
  const notes = await meetingNoteService.getMeetingNotes(req.params.projectId, req.user._id);
  res.json(notes);
});

exports.createMeetingNote = asyncHandler(async (req, res) => {
  const note = await meetingNoteService.createMeetingNote(req.params.projectId, req.user._id, req.body);
  res.status(201).json(note);
});

exports.updateMeetingNote = asyncHandler(async (req, res) => {
  const note = await meetingNoteService.updateMeetingNote(
    req.params.projectId,
    req.params.meetingId,
    req.user._id,
    req.body
  );
  res.json(note);
});

exports.deleteMeetingNote = asyncHandler(async (req, res) => {
  const result = await meetingNoteService.deleteMeetingNote(
    req.params.projectId,
    req.params.meetingId,
    req.user._id
  );
  res.json(result);
});