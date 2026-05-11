const mongoose = require('mongoose');

const leaderboardSchema = new mongoose.Schema({
  userId:     { type: String, required: true, unique: true },
  username:   { type: String, required: true },
  totalGames: { type: Number, default: 0 },
  totalScore: { type: Number, default: 0 },
  wins:       { type: Number, default: 0 }
}, { timestamps: true, collection: 'leaderboard' });

module.exports = mongoose.model('Leaderboard', leaderboardSchema);
