const { getIo } = require('./socketRegistry');

function resolveIo(req) {
    try {
        if (req?.app) {
            const io = req.app.get('io');
            if (io) return io;
        }
    } catch (_) { /* ignore */ }
    return getIo();
}

/**
 * Push a lightweight payload to a user's socket room so the client can
 * refresh unread counts and show a toast (see SocketContext: notification:new).
 * `req` may be null; IO is taken from the socket registry when `req.app` is missing.
 */
function emitSocketNotification(req, userId, notificationDoc) {
    if (!userId) return;
    try {
        const io = resolveIo(req);
        if (!io) return;
        const uid = userId._id ? userId._id.toString() : String(userId);
        const doc = notificationDoc && typeof notificationDoc.toObject === 'function'
            ? notificationDoc.toObject()
            : notificationDoc;
        if (!doc) return;
        io.to(`user:${uid}`).emit('notification:new', {
            _id: doc._id,
            type: doc.type,
            title: doc.title,
            message: doc.message,
            relatedId: doc.relatedId,
            relatedModel: doc.relatedModel,
            companyId: doc.company
        });
    } catch (err) {
        console.error('emitSocketNotification:', err.message);
    }
}

module.exports = emitSocketNotification;
