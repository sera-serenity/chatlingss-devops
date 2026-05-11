const express = require('express');
const router  = express.Router();
const Room    = require('../models/Room');

// POST /api/rooms/create
router.post('/create', async (req, res) => {
  try {
    const { name, theme, purpose, description, createdBy, isPublic, roomType, gameType, maxPlayers } = req.body;
    let code = undefined;
    const isPublicFinal = isPublic !== false;
    
    if (!isPublicFinal) {
      code = Math.floor(10000 + Math.random() * 90000).toString();
    }
    
    const room = await Room.create({ 
      name, theme, purpose, description, createdBy, isPublic: isPublicFinal, code,
      roomType: roomType || 'chat',
      gameType: gameType || 'none',
      maxPlayers: maxPlayers || 0
    });
    res.status(201).json(room);
  } catch (err) {
    if (err.code === 11000) {
      res.status(400).json({ error: 'Room name already taken' });
    } else {
      res.status(400).json({ error: err.message });
    }
  }
});

// GET /api/rooms — list all rooms
router.get('/', async (req, res) => {
  try {
    // Return all rooms, but exclude the 'code' field so it's not visible
    const rooms = await Room.find({}).select('-code').sort({ createdAt: -1 }).limit(50);
    res.json(rooms);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/rooms/verify-code
router.post('/verify-code', async (req, res) => {
  try {
    const { roomId, code } = req.body;
    const room = await Room.findById(roomId);
    if (!room) return res.status(404).json({ error: 'Room not found' });
    if (room.isPublic) return res.json({ success: true });
    
    if (room.code !== code) {
      return res.status(401).json({ error: 'Invalid 5-digit code' });
    }
    res.json({ success: true, room });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/rooms/:roomName — fetch specific room
router.get('/:roomName', async (req, res) => {
  try {
    const room = await Room.findOne({ name: req.params.roomName });
    if (!room) return res.status(404).json({ error: 'Room not found' });
    res.json(room);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/rooms/:id/online — update online count (internal)
router.patch('/:id/online', async (req, res) => {
  try {
    const { delta } = req.body; // +1 or -1
    const room = await Room.findById(req.params.id);
    if (!room) return res.status(404).json({ error: 'Room not found' });
    
    room.onlineCount = Math.max(0, (room.onlineCount || 0) + (delta || 0));
    await room.save();
    res.json(room);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/rooms/:id/details — fetch specific room by ID (not name)
router.get('/:id/details', async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);
    if (!room) return res.status(404).json({ error: 'Room not found' });
    res.json(room);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/rooms/:id/pin — pin a message
router.post('/:id/pin', async (req, res) => {
  try {
    const { senderName, text, timestamp } = req.body;
    const room = await Room.findByIdAndUpdate(
      req.params.id,
      { 
        $push: { pinnedMessages: { senderName, text, timestamp: timestamp || new Date() } },
        $push: { memory: { type: 'pinned', content: text, author: senderName, timestamp: timestamp || new Date() } }
      },
      { new: true }
    );
    res.json(room);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/rooms/:id/sticky — add/update sticky note
router.post('/:id/sticky', async (req, res) => {
  try {
    const { id: noteId, x, y, color, text, userName, type, data } = req.body;
    const room = await Room.findById(req.params.id);
    if (!room) return res.status(404).json({ error: 'Room not found' });

    const existingIdx = room.stickyNotes.findIndex(n => n.id === noteId);
    if (existingIdx !== -1) {
      room.stickyNotes[existingIdx] = { id: noteId, x, y, color, text, userName, type, data };
    } else {
      room.stickyNotes.push({ id: noteId, x, y, color, text, userName, type, data });
    }
    await room.save();
    res.json(room);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/rooms/:id/sticky/:noteId — remove sticky note
router.delete('/:id/sticky/:noteId', async (req, res) => {
  try {
    const room = await Room.findByIdAndUpdate(
      req.params.id,
      { $pull: { stickyNotes: { id: req.params.noteId } } },
      { new: true }
    );
    res.json(room);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/rooms/:id/playlist — update room playlist/queue
router.post('/:id/playlist', async (req, res) => {
  try {
    const { song } = req.body; // { id, title, url, addedBy }
    const room = await Room.findByIdAndUpdate(
      req.params.id,
      { $push: { playlist: song } },
      { new: true }
    );
    res.json(room);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/rooms/:id/memory — add to room intelligence memory
router.post('/:id/memory', async (req, res) => {
  try {
    const { type, content, author } = req.body;
    const room = await Room.findByIdAndUpdate(
      req.params.id,
      { $push: { memory: { type, content, author, timestamp: new Date() } } },
      { new: true }
    );
    res.json(room);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
