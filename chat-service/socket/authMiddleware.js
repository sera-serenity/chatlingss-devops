const jwt = require('jsonwebtoken');

/**
 * Socket.io middleware to authenticate the JWT token
 * passed as handshake auth: { token: '...' }
 */
const socketAuth = (socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error('Authentication required'));

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.user = decoded; // attach user to socket
    next();
  } catch (err) {
    next(new Error('Invalid or expired token'));
  }
};

module.exports = socketAuth;
