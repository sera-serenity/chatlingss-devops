require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./db');
const authRoutes = require('../routes/auth');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'auth-service' }));

// Routes
app.use('/api/auth', authRoutes);

// Connect DB then start server
const PORT = process.env.PORT || 5001;
connectDB().then(() => {
  app.listen(PORT, () => console.log(`🚀 auth-service running on port ${PORT}`));
});
