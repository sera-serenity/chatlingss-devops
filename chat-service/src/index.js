require('dotenv').config();
const http = require('http');
const express = require('express');
const cors = require('cors');
const { Server } = require('socket.io');
const registerSocketHandlers = require('../socket/handlers');

const app = express();
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'chat-service' }));

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Register all Socket.io event handlers
registerSocketHandlers(io);

const PORT = process.env.PORT || 5002;
server.listen(PORT, () => console.log(`🚀 chat-service running on port ${PORT}`));
