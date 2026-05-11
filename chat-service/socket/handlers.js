const socketAuth = require('./authMiddleware');
const {
  persistMessage,
  fetchHistory,
  updateOnlineCount,
  persistDrawingEvent,
  fetchDrawingHistory,
  clearDrawingHistory
} = require('./messageClient');

// In-memory state (stateless-friendly; for prod, use Redis)
const players = {};
const roomMusic = {};    // roomId -> { url, title, playing, startTime, sender }
const roomVideos = {};   // roomId -> { videoId, currentTime, isPlaying, lastUpdated, sender }
const roomDrawings = {}; // roomId -> array of strokes (in-memory fallback)

const registerSocketHandlers = (io) => {
  // Apply JWT auth middleware
  io.use(socketAuth);

  io.on('connection', (socket) => {
    const { id: userId, _id: userId2, username } = socket.user;
    // Support both id and _id JWT formats
    const resolvedUserId = userId || userId2 || socket.id;
    console.log(`🔗 ${username} (${socket.id}) connected | userId: ${resolvedUserId}`);

    // ── JOIN ──────────────────────────────────────────────────────
    socket.on('join', async (data) => {
      const room = data.room || 'general';
      socket.join(room);

      const spawnX = 120 + Math.random() * 400;
      const spawnY = 540; // approx FLOOR_Y

      players[socket.id] = {
        id: socket.id,
        userId: resolvedUserId,
        username,
        avatar: data.avatar || 'bunny',
        color:  data.color  || '#ffffff',
        prop:   data.prop   || 'none',
        mood:   data.mood   || 'happy',
        room,
        x: spawnX, y: spawnY,
        vx: 0, vy: 0,
        action: 'idle',
        lastUpdate: Date.now()
      };

      // Send existing players + chat history to joiner
      let history = [];
      try {
        history = await fetchHistory(room, data.lastSeenTimestamp);
      } catch (_) {}

      // Calculate room online count
      const onlineCount = io.sockets.adapter.rooms.get(room)?.size || 0;

      // Fetch room metadata (pins, sticks, memory)
      let roomInfo = null;
      if (room !== 'general' && room !== 'global') {
        roomInfo = await require('./messageClient').getRoomDetails(room);
      }

      // Fetch drawing history from MongoDB (persisted strokes)
      let drawingHistory = [];
      try {
        drawingHistory = await fetchDrawingHistory(room);
      } catch (_) {}

      socket.emit('init', {
        id: socket.id,
        players: Object.fromEntries(
          Object.entries(players).filter(([, p]) => p.room === room)
        ),
        chatHistory: history,
        drawingHistory: drawingHistory,   // From MongoDB (persisted)
        roomOnlineCount: onlineCount,
        music: roomMusic[room] || null,
        movie: roomVideos[room] || null,  // Current video state for late joiners
        drawings: roomDrawings[room] || [], // In-memory fallback
        roomInfo: roomInfo
      });

      // Notify others in room
      socket.to(room).emit('playerJoined', players[socket.id]);
      io.to(room).emit('roomOnlineCount', { roomId: room, count: onlineCount });

      // Update DB online count (async)
      if (room !== 'general' && room !== 'global') {
        updateOnlineCount(room, 1);
      }
    });

    // ── PLAYER UPDATE (position/state) ─────────────────────────
    socket.on('update', (sdata) => {
      if (!players[socket.id]) return;
      Object.assign(players[socket.id], sdata, { lastUpdate: Date.now() });
      socket.to(players[socket.id].room).emit('playerUpdated', players[socket.id]);
    });

    // ── ACTION (wave / dance / hug etc.) ──────────────────────
    socket.on('action', (adata) => {
      const room = players[socket.id]?.room || 'general';
      socket.to(room).emit('playerAction', { id: socket.id, ...adata });
    });

    // ── MUSIC (youtube sync) ──────────────────────────────────
    socket.on('musicTrack', (mdata) => {
      const room = players[socket.id]?.room || 'general';
      if (!mdata.url) {
        delete roomMusic[room];
      } else {
        roomMusic[room] = {
          ...mdata,
          sender: username,
          startTime: Date.now()
        };
      }
      io.to(room).emit('musicUpdate', roomMusic[room] || null);
    });

    // ── VIDEO SYNC (Movie Theatre) ────────────────────────────
    // Step 1: Host starts a new video
    socket.on('videoStart', ({ videoId }) => {
      const room = players[socket.id]?.room || 'general';
      if (!videoId) return;

      roomVideos[room] = {
        videoId,
        currentTime: 0,
        isPlaying: true,
        lastUpdated: Date.now(),
        sender: username
      };

      console.log(`🎬 Video started in room ${room}: ${videoId}`);
      io.to(room).emit('videoUpdate', roomVideos[room]);
    });

    // Step 2: Play / Pause / Seek
    socket.on('videoAction', ({ action, currentTime }) => {
      const room = players[socket.id]?.room || 'general';
      if (!roomVideos[room]) return;

      const state = roomVideos[room];
      state.currentTime = currentTime ?? state.currentTime;
      state.isPlaying = action === 'play';
      state.lastUpdated = Date.now();

      io.to(room).emit('videoUpdate', state);
    });

    // Step 3: Drift correction — client requests current state
    socket.on('requestSync', () => {
      const room = players[socket.id]?.room || 'general';
      if (roomVideos[room]) {
        socket.emit('videoUpdate', roomVideos[room]);
      }
    });

    // Legacy videoUpdate support (for backward compat during transition)
    socket.on('videoUpdate', (vdata) => {
      const room = players[socket.id]?.room || 'general';
      if (!vdata.videoId) {
        delete roomVideos[room];
      } else {
        roomVideos[room] = {
          videoId: vdata.videoId,
          currentTime: vdata.currentTime ?? 0,
          isPlaying: vdata.playing ?? true,
          lastUpdated: Date.now(),
          sender: username
        };
      }
      io.to(room).emit('movieUpdate', roomVideos[room] || null);
    });

    // ── DRAWING (shared whiteboard) ───────────────────────────
    socket.on('draw', async (stroke) => {
      const room = players[socket.id]?.room || 'general';
      console.log(`🎨 Received draw event from ${username} for room: ${room}`);
      if (!roomDrawings[room]) roomDrawings[room] = [];
      roomDrawings[room].push(stroke);

      // Prevent memory leaks for in-memory fallback
      if (roomDrawings[room].length > 1000) {
        roomDrawings[room].shift();
      }

      io.to(room).emit('draw', stroke);

      // PERSIST TO MONGODB — use resolvedUserId to avoid Mongoose validation errors
      persistDrawingEvent({
        roomId: room,
        userId: resolvedUserId,
        type: stroke.type || (stroke.eraser ? 'eraser' : 'stroke'),
        data: {
          points: stroke.points,
          color:  stroke.color,
          size:   stroke.size,
          alpha:  stroke.alpha,
          eraser: stroke.eraser,
          stamp:  stroke.stamp
        },
        timestamp: Date.now()
      });

      // Save to Room Memory if it's a significant stroke
      if (room !== 'general' && room !== 'global' && stroke.points && stroke.points.length > 10) {
        const { addToMemory } = require('./messageClient');
        addToMemory(room, {
          type: 'doodle',
          content: `🎨 New drawing created by ${username}`,
          author: username
        });
      }
    });

    socket.on('requestDrawings', () => {
      const room = players[socket.id]?.room || 'general';
      socket.emit('syncDrawings', roomDrawings[room] || []);
    });

    socket.on('clearCanvas', async () => {
      const room = players[socket.id]?.room || 'general';

      // Clear in-memory store
      roomDrawings[room] = [];

      // Broadcast clear to all clients in room
      io.to(room).emit('clearCanvas');

      // 🔑 Also wipe from MongoDB so late joiners don't replay old strokes
      try {
        await clearDrawingHistory(room);
      } catch (err) {
        console.error('❌ Failed to clear drawing history from DB:', err.message);
      }
    });

    // ── CHAT MESSAGE ──────────────────────────────────────────
    socket.on('chat', async (msg, ackCallback) => {
      const player = players[socket.id];
      if (!player) return;

      const { randomUUID } = require('crypto');
      const messageId = msg.messageId || randomUUID();
      const isObj = typeof msg === 'object' && msg !== null;
      const text = isObj ? msg.text : String(msg);

      const entry = {
        messageId,
        id:     socket.id,
        userId: resolvedUserId,
        sender: player.username,
        avatar: player.avatar,
        room:   player.room,
        text:   text,
        fileUrl: isObj ? msg.fileUrl : undefined,
        fileName: isObj ? msg.fileName : undefined,
        fileType: isObj ? msg.fileType : undefined,
        ts:     Date.now(),
        status: 'sent',
        seenBy: []
      };

      try {
        await persistMessage({
          messageId: entry.messageId,
          senderId: resolvedUserId,
          senderName: entry.sender,
          avatar: entry.avatar,
          roomId:   entry.room,
          text:   entry.text,
          fileUrl: entry.fileUrl,
          fileName: entry.fileName,
          fileType: entry.fileType,
          timestamp:     entry.ts
        });

        io.to(player.room).emit('chat', entry);

        if (ackCallback) ackCallback({ success: true, messageId });

      } catch (err) {
        console.error('Failed to save/send message', err);
        if (ackCallback) ackCallback({ success: false, error: err.message });
      }
    });

    // ── MESSAGE ACKNOWLEDGEMENTS ─────────────────────────────
    socket.on('messageDelivered', async (messageId) => {
      const { updateMessageStatus } = require('./messageClient');
      await updateMessageStatus(messageId, 'delivered');

      const room = players[socket.id]?.room || 'general';
      io.to(room).emit('messageStatusUpdated', { messageId, status: 'delivered' });
    });

    socket.on('messageSeen', async (messageId) => {
      const { updateMessageStatus } = require('./messageClient');
      const updatedMsg = await updateMessageStatus(messageId, 'seen', resolvedUserId);

      const room = players[socket.id]?.room || 'general';
      if (updatedMsg) {
        io.to(room).emit('messageStatusUpdated', {
          messageId,
          status: 'seen',
          seenBy: updatedMsg.seenBy
        });
      } else {
        io.to(room).emit('messageStatusUpdated', { messageId, status: 'seen' });
      }
    });

    // ── RETRY MESSAGE ─────────────────────────────────────────
    socket.on('retryMessage', async (msg) => {
      if (msg.retryCount >= 3) return;
      const { updateMessageRetryCount, updateMessageStatus } = require('./messageClient');

      msg.retryCount = (msg.retryCount || 0) + 1;
      await updateMessageRetryCount(msg.messageId, msg.retryCount);

      try {
        io.to(msg.room).emit('chat', msg);
        await updateMessageStatus(msg.messageId, 'delivered');
      } catch (err) {
        await updateMessageStatus(msg.messageId, 'failed');
      }
    });

    // ── SEND MESSAGE (Alternative) ───────────────────────────
    socket.on('sendMessage', async (data, ackCallback) => {
      const player = players[socket.id];
      const targetRoom = data.room || (player && player.room) || 'general';
      const { randomUUID } = require('crypto');
      const messageId = data.messageId || randomUUID();

      const entry = {
        messageId,
        userId: resolvedUserId,
        sender: data.sender || (player && player.username) || 'Anon',
        avatar: data.avatar || (player && player.avatar) || 'bunny',
        room:   targetRoom,
        text:   data.text,
        ts:     Date.now(),
        status: 'sent'
      };

      try {
        await persistMessage({
          messageId: entry.messageId,
          senderId: resolvedUserId,
          senderName: entry.sender,
          avatar: entry.avatar,
          roomId: entry.room,
          text: entry.text,
          timestamp: entry.ts
        });

        io.to(targetRoom).emit('receiveMessage', entry);
        if (ackCallback) ackCallback({ success: true, messageId });
      } catch (err) {
        if (ackCallback) ackCallback({ success: false, error: err.message });
      }
    });

    // ── PIN MESSAGE ──────────────────────────────────────────
    socket.on('pinMessage', (data) => {
      const room = players[socket.id]?.room;
      if (!room) return;
      const { pinMessage, addToMemory } = require('./messageClient');
      pinMessage(room, data);
      io.to(room).emit('roomUpdate', { type: 'pin', data });
    });

    // ── BOOKMARK MESSAGE ──────────────────────────────────────
    socket.on('bookmarkMessage', (data) => {
      const token = socket.handshake.auth.token || socket.handshake.query.token;
      if (!token) return;
      const { addBookmark } = require('./messageClient');
      addBookmark(token, data);
      socket.emit('bookmarkConfirmed', { success: true });
    });

    // ── STICKY NOTES ─────────────────────────────────────────
    socket.on('addStickyNote', (note) => {
      const room = players[socket.id]?.room;
      if (!room) return;
      const { updateStickyNote, addToMemory } = require('./messageClient');
      updateStickyNote(room, note);
      io.to(room).emit('stickyNoteUpdate', note);

      if (room !== 'general' && room !== 'global') {
        addToMemory(room, {
          type: 'sticky',
          content: `📝 New sticky note added: "${note.text.slice(0, 35)}..."`,
          author: username
        });
      }
    });

    socket.on('deleteStickyNote', (noteId) => {
      const room = players[socket.id]?.room;
      if (!room) return;
      const { deleteStickyNote } = require('./messageClient');
      deleteStickyNote(room, noteId);
      io.to(room).emit('stickyNoteDeleted', noteId);
    });

    // ── POLLS ─────────────────────────────────────────────────
    socket.on('pollCreated', (poll) => {
      const room = players[socket.id]?.room;
      if (!room) return;
      const { addToMemory } = require('./messageClient');
      addToMemory(room, { type: 'poll', content: poll.question, author: username });
      io.to(room).emit('pollUpdate', { ...poll, sender: username, id: Date.now() });
    });

    socket.on('pollVote', (voteData) => {
      const room = players[socket.id]?.room;
      if (!room) return;
      io.to(room).emit('pollVoteUpdate', voteData);
    });

    // ── SOCIAL (friend requests) ─────────────────────────────
    socket.on('friendRequest', (data) => {
      const { targetUserId } = data;
      const targetSocketId = Object.keys(players).find(sid => players[sid].userId === targetUserId);
      if (targetSocketId) {
        io.to(targetSocketId).emit('friendRequestIncoming', {
          fromId: resolvedUserId,
          fromName: username,
          fromAvatar: players[socket.id]?.avatar || 'bunny'
        });
      }
    });

    socket.on('friendRequestResponse', (data) => {
      const { targetUserId, accepted } = data;
      const targetSocketId = Object.keys(players).find(sid => players[sid].userId === targetUserId);
      if (targetSocketId) {
        io.to(targetSocketId).emit('friendRequestUpdate', {
          fromName: username,
          accepted
        });
      }
    });

    // ── PLAYLIST ──────────────────────────────────────────────
    socket.on('songAdded', (song) => {
      const room = players[socket.id]?.room;
      if (!room) return;
      io.to(room).emit('playlistUpdate', song);
    });

    // ── DISCONNECT ────────────────────────────────────────────
    socket.on('disconnect', () => {
      console.log(`❌ ${username} (${socket.id}) disconnected`);
      const room = players[socket.id]?.room;
      if (room) {
        const newCount = (io.sockets.adapter.rooms.get(room)?.size || 0);
        io.to(room).emit('playerLeft', socket.id);
        io.to(room).emit('roomOnlineCount', { roomId: room, count: newCount });

        if (room !== 'general' && room !== 'global') {
          updateOnlineCount(room, -1);
        }
      }
      delete players[socket.id];
    });
  });
};

module.exports = registerSocketHandlers;
