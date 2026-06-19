const MeetingNote = require('../models/MeetingNote');
const { assertProjectAccess } = require('../utils/projectAccess');
const ApiError = require('../utils/ApiError');

const populateNote = async (note) => {
  await note.populate('organizer', 'name email');
  await note.populate('attendees.user', 'name email');
  await note.populate('agenda.presenter', 'name email');
  await note.populate('actionItems.assignedTo', 'name email');
  await note.populate('decisions.decidedBy', 'name email');
  return note;
};

const getMeetingNotes = async (projectId, userId) => {
  await assertProjectAccess(projectId, userId);
  return MeetingNote.find({ project: projectId })
    .populate('organizer', 'name email')
    .populate('attendees.user', 'name email')
    .populate('agenda.presenter', 'name email')
    .populate('actionItems.assignedTo', 'name email')
    .populate('decisions.decidedBy', 'name email')
    .sort({ meetingDate: -1 });
};

const createMeetingNote = async (projectId, userId, data) => {
  await assertProjectAccess(projectId, userId);
  const meetingNote = new MeetingNote({ ...data, project: projectId, organizer: userId });
  await meetingNote.save();
  await populateNote(meetingNote);
  return meetingNote;
};

const updateMeetingNote = async (projectId, meetingId, userId, data) => {
  await assertProjectAccess(projectId, userId);
  const meetingNote = await MeetingNote.findOne({ _id: meetingId, project: projectId });
  if (!meetingNote) throw ApiError.notFound('Meeting note not found');
  Object.assign(meetingNote, data);
  await meetingNote.save();
  await populateNote(meetingNote);
  return meetingNote;
};

const deleteMeetingNote = async (projectId, meetingId, userId) => {
  await assertProjectAccess(projectId, userId);
  const meetingNote = await MeetingNote.findOne({ _id: meetingId, project: projectId });
  if (!meetingNote) throw ApiError.notFound('Meeting note not found');
  await MeetingNote.findByIdAndDelete(meetingId);
  return { message: 'Meeting note deleted successfully' };
};

module.exports = {
  getMeetingNotes,
  createMeetingNote,
  updateMeetingNote,
  deleteMeetingNote
};
