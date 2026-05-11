const mongoose = require('mongoose');

const playerSchema = new mongoose.Schema({
  userId:   { type: String },
  username: { type: String },
  score:    { type: Number, default: 0 }
}, { _id: false });

const gameSessionSchema = new mongoose.Schema({
  gameId:      { type: String, required: true, unique: true },
  gameType:    { type: String },
  roomId:      { type: String },
  players:     [playerSchema],
  tournamentId: { type: String, default: null },
  status:      { type: String, enum: ['active', 'ended'], default: 'active' },
  finalScores: { type: mongoose.Schema.Types.Mixed, default: {} },
  startedAt:   { type: Date },
  endedAt:     { type: Date }
}, { timestamps: true, collection: 'game_sessions' });

module.exports = mongoose.model('GameSession', gameSessionSchema);
