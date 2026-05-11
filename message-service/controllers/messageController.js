const Message = require('../models/Message');

const LIMIT = parseInt(process.env.MESSAGE_HISTORY_LIMIT || '100', 10);

// POST /api/messages  — store a new message
const saveMessage = async (req, res) => {
  try {
    const { messageId, senderId, senderName, avatar, roomId, text, content, fileUrl, fileName, fileType, timestamp } = req.body;
    
    const finalContent = content || text;
    if (!senderName || !finalContent)
      return res.status(400).json({ error: 'senderName and content/text are required' });

    const msgData = { 
      senderId, 
      senderName, 
      avatar, 
      roomId, 
      content: finalContent,
      fileUrl,
      fileName,
      fileType,
      timestamp,
      status: "sent"
    };
    if (messageId) {
      msgData.messageId = messageId;
    }

    const msg = await Message.create(msgData);
    res.status(201).json(msg);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// PATCH /api/messages/:messageId/status - update message status
const updateStatus = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { status, userId } = req.body;
    
    if (!["delivered", "seen", "failed"].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const updateData = { status };
    if (status === "delivered") updateData.deliveredAt = new Date();
    if (status === "seen") {
      updateData.seenAt = new Date();
      if (userId) {
        // Atomic update to add to seenBy array
        const msg = await Message.findOneAndUpdate(
          { messageId },
          { 
            ...updateData,
            $addToSet: { seenBy: userId } 
          },
          { new: true }
        );
        if (!msg) return res.status(404).json({ error: 'Message not found' });
        return res.json(msg);
      }
    }

    const msg = await Message.findOneAndUpdate(
      { messageId },
      updateData,
      { new: true }
    );

    if (!msg) return res.status(404).json({ error: 'Message not found' });
    res.json(msg);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// PATCH /api/messages/:messageId/retry - update retry count
const updateRetryCount = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { retryCount } = req.body;
    
    const msg = await Message.findOneAndUpdate(
      { messageId },
      { retryCount },
      { new: true }
    );

    if (!msg) return res.status(404).json({ error: 'Message not found' });
    res.json(msg);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// GET /api/messages/:room  — retrieve recent messages for a room
const getMessages = async (req, res) => {
  try {
    const { room } = req.params;
    const { since } = req.query; // for fetching missed messages
    
    const query = { roomId: room };
    if (since) {
      query.timestamp = { $gt: new Date(since) };
    }
    
    const messages = await Message.find(query)
      .sort({ timestamp: -1 })
      .limit(LIMIT)
      .lean();
    
    // map messages so they remain compatible with frontend clients expecting old fields
    const mapped = messages.map(m => ({
      ...m,
      userId: m.senderId,
      sender: m.senderName,
      room: m.roomId,
      ts: m.timestamp,
      text: m.content || m.text // Ensure text is present for old clients
    }));
    
    res.json(mapped.reverse()); // oldest first
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// GET /api/messages  — retrieve recent messages across all rooms
const getAllMessages = async (req, res) => {
  try {
    const messages = await Message.find()
      .sort({ timestamp: -1 })
      .limit(LIMIT)
      .lean();
    
    // map messages for compatibility
    const mapped = messages.map(m => ({
      ...m,
      userId: m.senderId,
      sender: m.senderName,
      room: m.roomId,
      ts: m.timestamp,
      text: m.content || m.text
    }));
    
    res.json(mapped.reverse());
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = { saveMessage, getMessages, getAllMessages, updateStatus, updateRetryCount };
