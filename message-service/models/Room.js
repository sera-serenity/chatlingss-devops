const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema({
  name:        { type: String, required: true, unique: true, trim: true },
  theme:       { type: String, default: '🌸' },          // emoji theme
  purpose:     { type: String, default: '' },
  description: { type: String, default: '' },
  isPublic:    { type: Boolean, default: true },
  code:        { type: String },
  createdBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  onlineCount: { type: Number, default: 0 },
  roomType:    { type: String, enum: ['chat', 'game'], default: 'chat' },
  gameType:    { type: String, enum: ['drawing_guess', 'typing_race', 'territory_capture', 'tag_game', 'emoji_catch', 'none'], default: 'none' },
  maxPlayers:  { type: Number, default: 0 },
  pinnedMessages: [{ senderName: String, text: String, timestamp: Date }],
  memory: [{ type: { type: String }, content: String, author: String, timestamp: Date }],
  stickyNotes: [{
    id: String,
    x: Number,
    y: Number,
    color: String,
    text: String,
    userName: String,
    type: { type: String, default: 'text' }, // text, drawing, image
    data: String // drawing data or image URL
  }],
  playlist: [{ id: String, title: String, url: String, addedBy: String }],
  createdAt:   { type: Date, default: Date.now },
});

module.exports = mongoose.model('Room', roomSchema);
