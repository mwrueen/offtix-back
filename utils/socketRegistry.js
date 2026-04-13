/** Holds the Socket.IO server instance so emitters can run without an Express `req` (e.g. Passport callbacks). */
let ioInstance = null;

exports.setIo = (io) => {
  ioInstance = io;
};

exports.getIo = () => ioInstance;
