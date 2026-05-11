const {
  initGameState,
  handleGameEvent,
  handleGameChatMessage,
  getStateForClient,
  startTournament,
  gameStates,
  disconnectTimers,
  getGameStateSnapshot
} = require('./gameEngine');

const gameHandlers = (io) => {
  io.on('connection', (socket) => {
    const { username } = socket.user;
    console.log(`🔗 Player ${username} (${socket.id}) connected to game-service`);
    let currentRoom = null;

    socket.on('joinGame', (data) => {
      const room = data.room;
      const gameType = socket.handshake.query.gameType;

      currentRoom = room;
      socket.join(room);

      initGameState(room, gameType);
      handleGameEvent(io, socket, 'join', { room, ...data });
    });

    // ── RECOVERABILITY: rejoin an active game after disconnect ────────────────
    socket.on('rejoinGame', ({ gameId, room }) => {
      if (!room) return;

      const state = gameStates[room];
      if (!state) {
        console.log(`⚠️ rejoinGame: no state found for room ${room}`);
        return;
      }

      currentRoom = room;
      socket.join(room);

      // Cancel any pending removal timer
      if (disconnectTimers[socket.id]) {
        clearTimeout(disconnectTimers[socket.id]);
        delete disconnectTimers[socket.id];
        console.log(`♻️ ${username} rejoined room ${room} — grace timer cancelled`);
      }

      if (state.state === 'playing' || state.state === 'countdown') {
        // Reactivate player if still in state
        if (state.players[socket.id]) {
          state.players[socket.id].active = true;
        }
        // Send current game state to rejoining client
        socket.emit('GAME_STATE', getStateForClient(state, socket.id));
        console.log(`✅ Sent GAME_STATE to rejoining player ${username}`);

      } else if (state.state === 'game_over') {
        // Game ended while they were gone — send results
        socket.emit('GAME_ENDED', {
          gameId: state.gameId,
          scores: getStateForClient(state, socket.id).scores
        });
        console.log(`📊 Sent GAME_ENDED results to late rejoiner ${username}`);

      } else {
        // Waiting or idle — just send current state
        socket.emit('gameState', getStateForClient(state, socket.id));
      }
    });

    socket.on('updatePosition', (data) => {
      if (currentRoom) {
        handleGameEvent(io, socket, 'updatePosition', { room: currentRoom, ...data });
        // Broadcast to others for rendering
        socket.to(currentRoom).emit('playerUpdated', { id: socket.id, ...data });
      }
    });

    socket.on('gameAction', (data) => {
      const room = data.room || currentRoom;
      if (room) handleGameEvent(io, socket, data.action, { room, ...data });
    });

    socket.on('chatMessage', (data) => {
      const room = data.room || currentRoom;
      if (!room) return;

      // Try intercepting for games first
      const intercepted = handleGameChatMessage(io, socket, room, data.text);
      if (intercepted) return;

      const entry = {
        sender: username,
        room:   room,
        text:   data.text,
        ts:     Date.now()
      };

      io.to(room).emit('message', entry);
    });

    socket.on('draw', (stroke) => {
      if (currentRoom) {
        socket.to(currentRoom).emit('draw', stroke);
      }
    });

    socket.on('START_TOURNAMENT', async (data) => {
      const room = data.room || currentRoom;
      if (room) {
        await startTournament(io, room, {
          players: data.players,
          totalGames: data.totalGames,
          gameType: data.gameType
        });
      }
    });

    // ── DISCONNECT: start 10s grace period ───────────────────────────────────
    socket.on('disconnect', () => {
      console.log(`⚡ ${username} (${socket.id}) disconnected from game-service`);
      if (currentRoom) {
        // Trigger the 'leave' action which now marks inactive + starts timer
        handleGameEvent(io, socket, 'leave', { room: currentRoom });
      }
    });
  });
};

module.exports = gameHandlers;
