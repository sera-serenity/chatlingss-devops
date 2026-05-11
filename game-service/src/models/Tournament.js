const mongoose = require('mongoose');

const playerSchema = new mongoose.Schema({
  userId:   { type: String, required: true },
  username: { type: String, required: true }
}, { _id: false });

const tournamentSchema = new mongoose.Schema({
  tournamentId:     { type: String, required: true, unique: true },
  roomId:           { type: String, required: true },
  players:          [playerSchema],
  totalGames:       { type: Number, default: 3 },
  currentGame:      { type: Number, default: 1 },
  cumulativeScores: { type: mongoose.Schema.Types.Mixed, default: {} },
  status:           { type: String, enum: ['active', 'ended'], default: 'active' },
  startedAt:        { type: Date, default: Date.now },
  endedAt:          { type: Date, default: null }
}, { timestamps: true, collection: 'tournaments' });

module.exports = mongoose.model('Tournament', tournamentSchema);
