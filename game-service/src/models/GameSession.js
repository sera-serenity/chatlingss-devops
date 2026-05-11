const mongoose = require('mongoose');

const playerSchema = new mongoose.Schema({
  userId:   { type: String, required: true },
  username: { type: String, required: true },
  score:    { type: Number, default: 0 }
}, { _id: false });

const gameSessionSchema = new mongoose.Schema({
  gameId:      { type: String, required: true, unique: true },
  gameType:    { type: String, required: true },
  roomId:      { type: String, required: true },
  players:     [playerSchema],
  tournamentId: { type: String, default: null },
  status:      { type: String, enum: ['active', 'ended'], default: 'active' },
  finalScores: { type: mongoose.Schema.Types.Mixed, default: {} },
  startedAt:   { type: Date, default: Date.now },
  endedAt:     { type: Date, default: null }
}, { timestamps: true, collection: 'game_sessions' });

module.exports = mongoose.model('GameSession', gameSessionSchema);
