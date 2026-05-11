const axios = require('axios');

const MESSAGE_SERVICE_URL = process.env.MESSAGE_SERVICE_URL || 'http://message-service:5003';

/**
 * Persist a message via message-service REST API (fire and forget)
 */
const persistMessage = async (payload) => {
  try {
    const res = await axios.post(`${MESSAGE_SERVICE_URL}/api/messages`, payload);
    return res.data;
  } catch (err) {
    console.error('❌ Failed to persist message:', err.message);
    throw err;
  }
};

const updateMessageStatus = async (messageId, status, userId) => {
  try {
    const res = await axios.patch(`${MESSAGE_SERVICE_URL}/api/messages/${messageId}/status`, { status, userId });
    return res.data;
  } catch (err) {
    console.error(`❌ Failed to update message status for ${messageId}:`, err.message);
  }
};

const updateMessageRetryCount = async (messageId, retryCount) => {
  try {
    const res = await axios.patch(`${MESSAGE_SERVICE_URL}/api/messages/${messageId}/retry`, { retryCount });
    return res.data;
  } catch (err) {
    console.error(`❌ Failed to update retry count for ${messageId}:`, err.message);
  }
};

const fetchHistory = async (room, since) => {
  const url = since
    ? `${MESSAGE_SERVICE_URL}/api/messages/${room}?since=${since}`
    : `${MESSAGE_SERVICE_URL}/api/messages/${room}`;
  const res = await axios.get(url);
  return res.data;
};

const updateOnlineCount = (roomId, delta) => {
  axios.patch(`${MESSAGE_SERVICE_URL}/api/rooms/${roomId}/online`, { delta })
    .catch(err => console.error('❌ Failed to update online count:', err.message));
};

const pinMessage = (roomId, payload) => {
  axios.post(`${MESSAGE_SERVICE_URL}/api/rooms/${roomId}/pin`, payload)
    .catch(err => console.error('❌ Failed to pin message:', err.message));
};

const updateStickyNote = (roomId, payload) => {
  axios.post(`${MESSAGE_SERVICE_URL}/api/rooms/${roomId}/sticky`, payload)
    .catch(err => console.error('❌ Failed to update sticky note:', err.message));
};

const deleteStickyNote = (roomId, noteId) => {
  axios.delete(`${MESSAGE_SERVICE_URL}/api/rooms/${roomId}/sticky/${noteId}`)
    .catch(err => console.error('❌ Failed to delete sticky note:', err.message));
};

const getRoomDetails = async (roomId) => {
  try {
    const res = await axios.get(`${MESSAGE_SERVICE_URL}/api/rooms/${roomId}/details`);
    return res.data;
  } catch (err) {
    console.error('❌ Failed to fetch room details:', err.message);
    return null;
  }
};

const addBookmark = (token, payload) => {
  const AUTH_URL = process.env.AUTH_SERVICE_URL || 'http://auth-service:5001';
  axios.post(`${AUTH_URL}/api/auth/bookmark`, payload, {
    headers: { Authorization: `Bearer ${token}` }
  }).catch(err => console.error('❌ Failed to add bookmark:', err.message));
};

const addToMemory = (roomId, payload) => {
  axios.post(`${MESSAGE_SERVICE_URL}/api/rooms/${roomId}/memory`, payload)
    .catch(err => console.error('❌ Failed to add to memory:', err.message));
};

const persistDrawingEvent = async (payload) => {
  console.log(`📤 Persisting drawing event for room ${payload.roomId} to ${MESSAGE_SERVICE_URL}/api/drawings`);
  try {
    const res = await axios.post(`${MESSAGE_SERVICE_URL}/api/drawings`, payload);
    return res.data;
  } catch (err) {
    console.error('❌ Failed to persist drawing event:', err.message);
  }
};

const fetchDrawingHistory = async (roomId) => {
  try {
    const res = await axios.get(`${MESSAGE_SERVICE_URL}/api/drawings/${roomId}`);
    return res.data;
  } catch (err) {
    console.error('❌ Failed to fetch drawing history:', err.message);
    return [];
  }
};

/**
 * Delete all drawing history for a room (called when canvas is cleared)
 */
const clearDrawingHistory = async (roomId) => {
  try {
    const res = await axios.delete(`${MESSAGE_SERVICE_URL}/api/drawings/${roomId}`);
    console.log(`🗑️ Cleared drawing history for room ${roomId}:`, res.data);
    return res.data;
  } catch (err) {
    console.error('❌ Failed to clear drawing history:', err.message);
  }
};

module.exports = {
  persistMessage,
  updateMessageStatus,
  updateMessageRetryCount,
  fetchHistory,
  updateOnlineCount,
  pinMessage,
  updateStickyNote,
  deleteStickyNote,
  getRoomDetails,
  addBookmark,
  addToMemory,
  persistDrawingEvent,
  fetchDrawingHistory,
  clearDrawingHistory
};
