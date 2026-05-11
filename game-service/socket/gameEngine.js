const { Queue } = require('bullmq');
const Redis = require('ioredis');
const { randomUUID } = require('crypto');
const GameSession = require('../src/models/GameSession');
const Tournament = require('../src/models/Tournament');

// ... existing code ...

const startTournament = async (io, room, { players, totalGames, gameType }) => {
  const tournamentId = randomUUID();
  
  await Tournament.create({
    tournamentId,
    roomId: room,
    players: players.map(p => ({ userId: p.userId, username: p.username })),
    totalGames,
    currentGame: 1,
    cumulativeScores: {},
    status: 'active'
  });

  const state = initGameState(room, gameType);
  state.tournamentId = tournamentId;
  
  io.to(room).emit('TOURNAMENT_STARTED', { tournamentId, players, totalGames });
  
  // The existing logic for starting a game usually happens when players join or a timer starts.
  // We can trigger it here or let the 'join' events handle it.
  // For now, just setting the ID is enough as the lobby will handle redirection.
  return tournamentId;
};

// ─── Redis + BullMQ queue ────────────────────────────────────────────────────
const redisConnection = new Redis(process.env.REDIS_URL || 'redis://redis:6379', {
  maxRetriesPerRequest: null
});
const gameQueue = new Queue('gameQueue', { connection: redisConnection });

// ─── Constants ───────────────────────────────────────────────────────────────
const GAME_WORDS = ['APPLE', 'BANANA', 'CAT', 'DOG', 'ELEPHANT', 'FLOWER', 'GUITAR', 'HOUSE', 'IGLOO', 'PIZZA', 'SUN', 'TREE', 'CAR', 'BIRD', 'FISH'];
const GAME_SENTENCES = [
  "The quick brown fox jumps over the lazy dog.",
  "Cute animals are the best things in the world.",
  "Programming is fun but sometimes frustrating.",
  "I love drinking hot chocolate on a cold day.",
  "Can you type this sentence faster than your friends?"
];

// ─── In-memory game states ────────────────────────────────────────────────────
// roomId -> { type, state, players, timeRemaining, interval, metadata, gameId }
const gameStates = {};

// ─── Disconnect grace timers ──────────────────────────────────────────────────
// socketId -> setTimeout handle (10s before fully removing a disconnected player)
const disconnectTimers = {};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const initGameState = (room, gameType) => {
  if (!gameStates[room]) {
    gameStates[room] = {
      type:          gameType,
      state:         'waiting',
      players:       {},
      timeRemaining: 0,
      interval:      null,
      metadata:      {},
      gameId:        null,
      tournamentId:  null
    };
  }
  return gameStates[room];
};

// ─── Snapshot of current game state for reconnecting clients ─────────────────
const getGameStateSnapshot = (room) => {
  const state = gameStates[room];
  if (!state) return null;
  return {
    gameId:       state.gameId,
    type:         state.type,
    state:        state.state,
    timeRemaining: state.timeRemaining,
    metadata:     state.metadata
  };
};

// ─── Push ended game to Redis queue ──────────────────────────────────────────
const pushGameEndedToQueue = async (room, state) => {
  try {
    const players = Object.entries(state.players).map(([socketId, p]) => ({
      userId:   p.userId   || socketId,
      username: p.username || 'Unknown'
    }));

    const scores = {};
    if (state.type === 'territory_capture') {
      const colorScores = {};
      Object.values(state.metadata.grid || {}).forEach(c => { colorScores[c] = (colorScores[c] || 0) + 1; });
      Object.entries(state.players).forEach(([id, p]) => {
        scores[p.userId || id] = colorScores[p.color || '#ff80bf'] || 0;
      });
    } else {
      Object.entries(state.players).forEach(([id, p]) => {
        scores[p.userId || id] = state.type === 'tag_game'
          ? Math.floor(p.tagTime || 0)
          : (p.score || 0);
      });
    }

    await gameQueue.add('GAME_ENDED', {
      gameId:       state.gameId,
      tournamentId: state.tournamentId || null,
      roomId:       room,
      gameType:     state.type,
      players,
      scores
    }, {
      attempts:  3,
      backoff:   { type: 'exponential', delay: 2000 }
    });

    console.log(JSON.stringify({
      service: 'game-service', event: 'GAME_QUEUED',
      gameId: state.gameId, roomId: room, timestamp: new Date().toISOString()
    }));
  } catch (err) {
    console.error('Failed to push game to queue:', err.message);
  }
};

// ─── Create GameSession in MongoDB ────────────────────────────────────────────
const createGameSession = async (room, state) => {
  try {
    const gameId = randomUUID();
    state.gameId = gameId;

    const players = Object.entries(state.players).map(([socketId, p]) => ({
      userId:   p.userId   || socketId,
      username: p.username || 'Unknown',
      score:    0
    }));

    await GameSession.create({
      gameId,
      gameType:     state.type,
      roomId:       room,
      tournamentId: state.tournamentId || null,
      players,
      status:       'active',
      startedAt:    new Date()
    });

    console.log(JSON.stringify({
      service: 'game-service', event: 'GAME_SESSION_CREATED',
      gameId, gameType: state.type, roomId: room, timestamp: new Date().toISOString()
    }));

    return gameId;
  } catch (err) {
    console.error('Failed to create game session:', err.message);
    return randomUUID(); // still return a gameId even if DB write fails
  }
};

// ─── Game loop start ──────────────────────────────────────────────────────────
const startGameLoop = async (io, room, state) => {
  if (state.interval) clearInterval(state.interval);

  // Create session and emit GAME_STARTED
  const gameId = await createGameSession(room, state);

  const playersList = Object.entries(state.players).map(([socketId, p]) => ({
    socketId,
    userId:   p.userId   || socketId,
    username: p.username || 'Unknown'
  }));

  io.to(room).emit('GAME_STARTED', {
    gameId,
    gameType: state.type,
    players:  playersList
  });

  if (state.type === 'drawing_guess') {
    state.state         = 'playing';
    state.timeRemaining = 45;
    const playerIds = Object.keys(state.players).filter(id => state.players[id].active !== false);
    if (playerIds.length === 0) return;
    state.drawerId   = playerIds[Math.floor(Math.random() * playerIds.length)];
    state.targetWord = null;
    const choices = [];
    while (choices.length < 3) {
      const w = GAME_WORDS[Math.floor(Math.random() * GAME_WORDS.length)];
      if (!choices.includes(w)) choices.push(w);
    }
    io.to(state.drawerId).emit('wordChoices', choices);
    io.to(room).emit('gameState', getStateForClient(state, null));
    io.to(room).emit('message', { sender: 'System', text: 'New round starting! Waiting for drawer to pick a word.', isSystem: true });
    startTimer(io, room, state);

  } else if (state.type === 'typing_race') {
    state.state          = 'countdown';
    state.timeRemaining  = 5;
    state.targetSentence = GAME_SENTENCES[Math.floor(Math.random() * GAME_SENTENCES.length)];
    io.to(room).emit('gameState', getStateForClient(state));
    io.to(room).emit('message', { sender: 'System', text: 'Get ready… Race starts in 5 seconds!', isSystem: true });

    const countInterval = setInterval(() => {
      state.timeRemaining--;
      if (state.timeRemaining <= 0) {
        clearInterval(countInterval);
        state.state         = 'playing';
        state.timeRemaining = 60;
        io.to(room).emit('gameState', getStateForClient(state));
        io.to(room).emit('message', { sender: 'System', text: 'GO! Type the sentence exactly!', isSystem: true });
        startTimer(io, room, state);
      } else {
        io.to(room).emit('gameState', getStateForClient(state));
      }
    }, 1000);
    return;

  } else if (state.type === 'territory_capture') {
    state.state           = 'playing';
    state.timeRemaining   = 60;
    state.metadata.grid   = {};
    io.to(room).emit('gameState', getStateForClient(state));
    io.to(room).emit('message', { sender: 'System', text: 'Paint the floor! The one with the most painted area wins!', isSystem: true });
    startTimer(io, room, state);

  } else if (state.type === 'tag_game') {
    state.state         = 'playing';
    state.timeRemaining = 120;
    const playerIds     = Object.keys(state.players);
    state.metadata.taggerId = playerIds[Math.floor(Math.random() * playerIds.length)];
    playerIds.forEach(id => { if (state.players[id].tagTime === undefined) state.players[id].tagTime = 0; });
    io.to(room).emit('gameState', getStateForClient(state));
    io.to(room).emit('message', { sender: 'System', text: 'Tag Game Started! Run!', isSystem: true });
    io.to(room).emit('assignTagger', { id: state.metadata.taggerId });
    startTimer(io, room, state);

  } else if (state.type === 'emoji_catch') {
    state.state                  = 'playing';
    state.timeRemaining          = 90;
    state.metadata.objects       = [];
    state.metadata.nextObjectId  = 0;
    io.to(room).emit('gameState', getStateForClient(state));
    io.to(room).emit('message', { sender: 'System', text: 'Catch the items! Avoid death! 🌟💀', isSystem: true });
    startTimer(io, room, state);
  }
};

const startCountdown = (io, room, state) => {
  state.state = 'countdown';
  state.timeRemaining = 3;
  io.to(room).emit('gameState', getStateForClient(state));
  
  const countInterval = setInterval(() => {
    state.timeRemaining--;
    if (state.timeRemaining <= 0) {
      clearInterval(countInterval);
      startGameLoop(io, room, state);
    } else {
      io.to(room).emit('gameState', getStateForClient(state));
    }
  }, 1000);
};

// ─── Game timer ───────────────────────────────────────────────────────────────
const startTimer = (io, room, state) => {
  state.interval = setInterval(() => {
    if (state.state === 'playing') {
      // Tag: accumulate tagger time
      if (state.type === 'tag_game' && state.metadata.taggerId) {
        if (!state.players[state.metadata.taggerId]) {
          const ids = Object.keys(state.players);
          if (ids.length > 0) state.metadata.taggerId = ids[0];
        } else {
          state.players[state.metadata.taggerId].tagTime += 0.1;
        }
      }

      // Emoji Catch: spawn falling objects
      if (state.type === 'emoji_catch') {
        state.metadata.spawnCounter = (state.metadata.spawnCounter || 0) + 1;
        if (state.metadata.spawnCounter >= 10) {
          state.metadata.spawnCounter = 0;
          const types = ['star', 'heart', 'smile', 'angry', 'skull', 'poison'];
          const type  = types[Math.floor(Math.random() * types.length)];
          const obj   = {
            id:     state.metadata.nextObjectId++,
            x:      50 + Math.random() * 700,
            y:      -50,
            type,
            points: ['star', 'heart', 'smile'].includes(type) ? 10 : -5
          };
          state.metadata.objects.push(obj);
          io.to(room).emit('spawnObject', obj);
        }
        state.metadata.objects.forEach(obj => { obj.y += 240 * 0.1; });
        state.metadata.objects = state.metadata.objects.filter(obj => obj.y < 900);
      }
    }

    // Decrement timer every 10 ticks (= 1 second)
    state.tickCounter = (state.tickCounter || 0) + 1;
    if (state.tickCounter >= 10) {
      state.tickCounter = 0;
      if (state.state === 'playing') {
        if (state.type === 'drawing_guess') {
          if (state.targetWord) state.timeRemaining--;
        } else {
          state.timeRemaining--;
        }
      } else if (state.state === 'countdown' || state.state === 'stopping_music') {
        state.timeRemaining--;
      }
    }

    if (state.timeRemaining <= 0) {
      handleRoundEnd(io, room, state);
    } else {
      if (state.tickCounter % 2 === 0) {
        io.to(room).emit('gameState', getStateForClient(state, null));
      }
    }
  }, 100);
};

// ─── Round / game end ─────────────────────────────────────────────────────────
const handleRoundEnd = async (io, room, state) => {
  clearInterval(state.interval);

  // Build final scores for client
  const finalScores = {};
  if (state.type === 'territory_capture') {
    const colorScores = {};
    Object.values(state.metadata.grid || {}).forEach(c => { colorScores[c] = (colorScores[c] || 0) + 1; });
    Object.entries(state.players).forEach(([id, p]) => {
      finalScores[id] = colorScores[p.color || '#ff80bf'] || 0;
    });

    let winningColor = null, maxScore = -1;
    Object.entries(colorScores).forEach(([color, score]) => {
      if (score > maxScore) { maxScore = score; winningColor = color; }
    });
    const winners = Object.values(state.players).filter(p => (p.color || '#ff80bf') === winningColor);
    if (winners.length > 0) {
      io.to(room).emit('message', {
        sender: 'System',
        text: `🏆 ${winners.map(w => w.username).join(', ')} WINS with color ${winningColor} (${maxScore} tiles)!`,
        isSystem: true
      });
    } else {
      io.to(room).emit('message', { sender: 'System', text: "Round over! It's a tie!", isSystem: true });
    }
  } else {
    Object.entries(state.players).forEach(([id, p]) => {
      finalScores[id] = state.type === 'tag_game' ? Math.floor(p.tagTime || 0) : (p.score || 0);
    });
    io.to(room).emit('message', { sender: 'System', text: 'Round over!', isSystem: true });
  }

  state.state = 'game_over';

  // ✅ Emit GAME_ENDED to all clients in the room
  io.to(room).emit('GAME_ENDED', {
    gameId: state.gameId,
    scores: finalScores
  });

  // ✅ Push to Redis queue for async backend processing
  await pushGameEndedToQueue(room, state);

  // Reset after 8s so players can play again
  setTimeout(() => {
    state.state         = 'waiting';
    state.gameId        = null;
    state.timeRemaining = 0;
    // Reset player scores
    Object.values(state.players).forEach(p => {
      p.score   = 0;
      p.tagTime = 0;
    });
    io.to(room).emit('gameState', getStateForClient(state, null));
  }, 8000);
};

// ─── State serialiser for client ─────────────────────────────────────────────
const getStateForClient = (state, socketId) => {
  const clientState = {
    state:         state.state,
    timeRemaining: state.timeRemaining,
    scores:        {},
    type:          state.type,
    gameId:        state.gameId
  };

  if (state.type === 'territory_capture') {
    const colorScores = {};
    Object.values(state.metadata.grid || {}).forEach(c => { colorScores[c] = (colorScores[c] || 0) + 1; });
    Object.entries(state.players).forEach(([id, p]) => {
      clientState.scores[id] = colorScores[p.color || '#ff80bf'] || 0;
    });
  } else {
    Object.entries(state.players).forEach(([id, p]) => {
      clientState.scores[id] = state.type === 'tag_game' ? Math.floor(p.tagTime) : (p.score || 0);
    });
  }

  clientState.players = {};
  Object.entries(state.players).forEach(([id, p]) => {
    clientState.players[id] = {
      username: p.username,
      avatar:   p.avatar || 'bunny',
      color:    p.color  || '#ff80bf'
    };
  });

  if (state.type === 'drawing_guess') {
    clientState.drawerId = state.drawerId;
    if (socketId === state.drawerId || state.state !== 'playing') {
      clientState.targetWord = state.targetWord;
    } else if (state.targetWord) {
      clientState.targetWord = state.targetWord.replace(/[a-zA-Z]/g, '_');
    }
  } else if (state.type === 'typing_race') {
    clientState.targetSentence = state.state === 'playing' ? state.targetSentence : '???';
  } else if (state.type === 'territory_capture') {
    clientState.grid = state.metadata.grid;
  } else if (state.type === 'tag_game') {
    clientState.taggerId = state.metadata.taggerId;
  } else if (state.type === 'emoji_catch') {
    clientState.objects = state.metadata.objects;
  }

  return clientState;
};

// ─── Game event handler ───────────────────────────────────────────────────────
const handleGameEvent = (io, socket, action, data) => {
  const room  = data.room;
  const state = gameStates[room];
  if (!state) return;

  if (action === 'join') {
    // ── RECOVERABILITY: handle rejoin of inactive player ──────────
    if (state.players[socket.id] && state.players[socket.id].active === false) {
      // Cancel the pending removal timer
      if (disconnectTimers[socket.id]) {
        clearTimeout(disconnectTimers[socket.id]);
        delete disconnectTimers[socket.id];
      }
      // Reactivate player
      state.players[socket.id].active = true;
      console.log(`♻️ Player ${socket.user.username} (${socket.id}) rejoined game in room ${room}`);
      // Send current game state immediately
      socket.emit('gameState', getStateForClient(state, socket.id));
      // If game ended while they were gone, send result
      if (state.state === 'game_over') {
        socket.emit('GAME_ENDED', { gameId: state.gameId, scores: getStateForClient(state, socket.id).scores });
      }
      io.to(room).emit('playerUpdated', { id: socket.id, username: socket.user.username, active: true });
      return;
    }

    if (!state.players[socket.id]) {
      state.players[socket.id] = {
        score:    0,
        tagTime:  0,
        username: socket.user.username,
        userId:   socket.user.id || socket.user._id || socket.id,
        color:    data.color || '#ff80bf',
        active:   true,
        x: 0, y: 0
      };
    }
    if (state.state === 'waiting' && Object.keys(state.players).length >= 2) {
      startCountdown(io, room, state);
    } else {
      socket.emit('gameState', getStateForClient(state, socket.id));
    }
    // Broadcast join to others with full info
    socket.to(room).emit('playerUpdated', { 
      id: socket.id, 
      username: socket.user.username,
      avatar: socket.user.avatar || 'bunny',
      color: data.color || '#ff80bf',
      x: 0, y: 0
    });
  }
  else if (action === 'leave') {
    // ── RECOVERABILITY: mark inactive, wait 10s before full removal ──
    if (state.players[socket.id]) {
      state.players[socket.id].active = false;
      console.log(`⏳ Player ${socket.id} marked inactive — 10s grace timer started`);

      disconnectTimers[socket.id] = setTimeout(() => {
        delete disconnectTimers[socket.id];
        if (gameStates[room] && gameStates[room].players[socket.id]) {
          delete gameStates[room].players[socket.id];
          io.to(room).emit('playerLeft', { id: socket.id });
          // If fewer than 2 active players, stall the game
          const activePlayers = Object.values(gameStates[room].players).filter(p => p.active !== false);
          if (activePlayers.length < 2 && gameStates[room].state === 'playing') {
            if (gameStates[room].interval) clearInterval(gameStates[room].interval);
            gameStates[room].state = 'waiting';
            io.to(room).emit('gameState', getStateForClient(gameStates[room], null));
            io.to(room).emit('message', { sender: 'System', text: '⏸ Not enough players — waiting for more...', isSystem: true });
          }
        }
      }, 10000); // 10 second grace period
    }
  }
  else if (action === 'updatePosition') {
    const p = state.players[socket.id];
    if (p) {
      p.x = data.x; p.y = data.y;
      
      // Immediate broadcast to others for zero-lag sync
      socket.to(room).emit('playerUpdated', { 
        id: socket.id, 
        x: p.x, 
        y: p.y,
        mood: data.mood || 'happy'
      });

      // Tag collision
      if (state.type === 'tag_game' && state.state === 'playing' && socket.id === state.metadata.taggerId) {
        Object.entries(state.players).forEach(([otherId, otherP]) => {
          if (otherId !== socket.id) {
            const dist = Math.hypot(p.x - otherP.x, p.y - otherP.y);
            if (dist < 40) {
              state.metadata.taggerId = otherId;
              io.to(room).emit('playerTagged', { taggerId: otherId });
              io.to(room).emit('message', { sender: 'System', text: `🏃 ${otherP.username} is now IT!`, isSystem: true });
            }
          }
        });
      }

      // Emoji Catch collision
      if (state.type === 'emoji_catch' && state.state === 'playing') {
        state.metadata.objects.forEach((obj, idx) => {
          const dist = Math.hypot(p.x + 20 - obj.x, p.y + 40 - obj.y);
          if (dist < 30) {
            p.score = (p.score || 0) + obj.points;
            state.metadata.objects.splice(idx, 1);
            io.to(room).emit('emojiCaught', { id: obj.id, playerId: socket.id, points: obj.points });
          }
        });
      }

      // Territory paint
      if (state.type === 'territory_capture' && state.state === 'playing') {
        // Updated to 60px to match frontend. 
        // Character is ~82px wide and ~90px tall at 1.8x scale.
        // We want the base center: x + 41, y + 90
        const gx = Math.floor((p.x + 41) / 60);
        const gy = Math.floor((p.y + 90) / 60);
        if (gx >= 0 && gx <= 200 && gy >= 0 && gy <= 200) {
          const cellKey  = `${gx},${gy}`;
          const pColor   = p.color || '#ff80bf';
          if (state.metadata.grid[cellKey] !== pColor) {
            state.metadata.grid[cellKey] = pColor;
            io.to(room).emit('paintCell', { cell: cellKey, id: socket.id, color: pColor });
          }
        }
      }
    }
  }
  else if (action === 'selectWord' && state.type === 'drawing_guess') {
    if (socket.id === state.drawerId) {
      state.targetWord = data.word;
      io.to(room).emit('gameState', getStateForClient(state, null));
      io.to(room).emit('message', { sender: 'System', text: `${socket.user.username} is drawing!`, isSystem: true });
    }
  }
};

// ─── In-game chat handler ─────────────────────────────────────────────────────
const handleGameChatMessage = (io, socket, room, text) => {
  const state = gameStates[room];
  if (!state || state.state !== 'playing') return false;

  if (state.type === 'drawing_guess') {
    if (socket.id === state.drawerId) return false;
    if (state.targetWord && text.toUpperCase().trim() === state.targetWord.toUpperCase()) {
      state.players[socket.id].score += 10;
      io.to(room).emit('message', { sender: 'System', text: `✨ ${socket.user.username} guessed the word! ✨`, isSystem: false, isSuccess: true });
      return true;
    }
  } else if (state.type === 'typing_race') {
    if (state.targetSentence && text === state.targetSentence) {
      state.players[socket.id].score += 20;
      io.to(room).emit('message', { sender: 'System', text: `🏆 ${socket.user.username} finished first!`, isSystem: false, isSuccess: true });
      state.timeRemaining = 0;
      return true;
    }
  }
  return false;
};

module.exports = { initGameState, handleGameEvent, handleGameChatMessage, getStateForClient, startTournament, gameStates, disconnectTimers, getGameStateSnapshot };
