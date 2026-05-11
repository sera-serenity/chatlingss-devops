require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./db');
const messageRoutes = require('../routes/messages');
const roomRoutes = require('../routes/rooms');
const fileRoutes = require('../routes/fileRoutes');
const drawingRoutes = require('../routes/drawingRoutes');

const app = express();
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'message-service' }));

// Routes
app.use('/api/messages', messageRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/drawings', drawingRoutes);

const PORT = process.env.PORT || 5003;
connectDB().then(async () => {
  console.log('✅ Message Service connected to MongoDB');
  // Temporary fix for legacy index issues in Room collection
  try {
    const Room = require('../models/Room');
    await Room.collection.dropIndex('code_1').catch(() => {});
  } catch (err) {}

  app.listen(PORT, () => {
    console.log(`🚀 message-service running on port ${PORT}`);
  });
});
