const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, trim: true },
  email:    { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true },
  avatar:   { type: String, default: 'bunny' },
  color:    { type: String, default: '#ffffff' },
  mood:     { type: String, default: 'happy' },
  prop:     { type: String, default: 'none' },
  roomsJoined: { type: Number, default: 0 },
  wordsGuessed: { type: Number, default: 0 },
  gamesWon:    { type: Number, default: 0 },
  friends: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  friendRequests: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  createdAt:{ type: Date, default: Date.now },
  bookmarks: [{
    senderName: String,
    text: String,
    roomId: String,
    timestamp: { type: Date, default: Date.now }
  }]
});

// Hash password before save
userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 12);
});

// Compare password helper
userSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

module.exports = mongoose.model('User', userSchema);
