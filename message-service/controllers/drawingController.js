const DrawingEvent = require('../models/DrawingEvent');

const saveDrawingEvent = async (req, res) => {
  console.log('📬 Received POST request to /api/drawings:', JSON.stringify(req.body).substring(0, 100));
  try {
    const { eventId, roomId, userId, type, data, timestamp } = req.body;
    
    const event = await DrawingEvent.create({
      eventId,
      roomId,
      // Fallback: use anonymous if userId is missing/undefined
      userId: userId || 'anonymous',
      type: type || 'stroke',
      data,
      timestamp: timestamp ? new Date(timestamp) : new Date()
    });
    
    console.log(`🖌️ Saved drawing stroke for room: ${roomId}`);
    res.status(201).json(event);
  } catch (err) {
    // Log full error including validation details
    console.error('❌ Drawing save error:', err.message, err.errors ? JSON.stringify(err.errors) : '');
    res.status(500).json({ error: 'Internal server error', detail: err.message });
  }
};

const getDrawingHistory = async (req, res) => {
  try {
    const { room } = req.params;
    const history = await DrawingEvent.find({ roomId: room })
      .sort({ timestamp: 1 }) // Chronological order for replaying
      .limit(1000) // Limit to last 1000 strokes to prevent overload
      .lean();
    
    res.json(history);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// DELETE /api/drawings/:room — wipe all drawing history for a room (called on clearCanvas)
const clearDrawingHistory = async (req, res) => {
  try {
    const { room } = req.params;
    const result = await DrawingEvent.deleteMany({ roomId: room });
    console.log(`🗑️ Cleared ${result.deletedCount} drawing events for room: ${room}`);
    res.json({ success: true, deleted: result.deletedCount });
  } catch (err) {
    console.error('❌ Failed to clear drawing history:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = { saveDrawingEvent, getDrawingHistory, clearDrawingHistory };
