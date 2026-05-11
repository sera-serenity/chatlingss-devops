require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const connectDB = require('./db');
const Redis = require('ioredis');
const socketAuth = require('../socket/authMiddleware');
const registerGameHandlers = require('../socket/gameHandlers');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

io.use(socketAuth);
registerGameHandlers(io);

// ─── Redis Subscriber for Tournament Updates ───────────────────────────────
const redisSub = new Redis(process.env.REDIS_URL || 'redis://redis:6379');
redisSub.subscribe('tournament_updates');
redisSub.on('message', (channel, message) => {
  if (channel === 'tournament_updates') {
    const data = JSON.parse(message);
    // data: { roomId, event, tournamentId, cumulativeScores, currentGame, totalGames }
    io.to(data.roomId).emit(data.event, data);
    console.log(`[RedisSub] Emitted ${data.event} to room ${data.roomId}`);
  }
});

// ── Leaderboard REST endpoint (read from MongoDB) ────────────────────────────
app.get('/leaderboard', async (req, res) => {
  try {
    const Leaderboard = require('./models/Leaderboard');
    const board = await Leaderboard.find({})
      .sort({ totalScore: -1 })
      .limit(20)
      .lean();
    res.json(board);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Game sessions REST endpoint ───────────────────────────────────────────────
app.get('/sessions', async (req, res) => {
  try {
    const GameSession = require('./models/GameSession');
    const sessions = await GameSession.find({})
      .sort({ startedAt: -1 })
      .limit(10)
      .lean();
    res.json(sessions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'game-service' }));

const PORT = process.env.PORT || 5004;
connectDB().then(() => {
  server.listen(PORT, () => {
    console.log(JSON.stringify({
      service: 'game-service', event: 'SERVER_STARTED',
      port: PORT, timestamp: new Date().toISOString()
    }));
  });
});
