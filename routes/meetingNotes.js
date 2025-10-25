const express = require('express');
const router = express.Router({ mergeParams: true });
const meetingNoteController = require('../controllers/meetingNoteController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get('/', meetingNoteController.getMeetingNotes);
router.post('/', meetingNoteController.createMeetingNote);
router.put('/:meetingId', meetingNoteController.updateMeetingNote);
router.delete('/:meetingId', meetingNoteController.deleteMeetingNote);

module.exports = router;