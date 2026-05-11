const mongoose = require('mongoose');
const { randomUUID } = require('crypto');

const messageSchema = new mongoose.Schema({
  messageId:  { type: String, required: true, unique: true, default: randomUUID },
  senderId:   { type: String, required: true },                 
  senderName: { type: String, required: true },
  avatar:     { type: String, default: 'bunny' },
  roomId:     { type: String, required: true, index: true },
  content:    { type: String }, // Used to be text
  
  // File details for backward compatibility or direct attachments
  fileUrl:    { type: String },
  fileName:   { type: String },
  fileType:   { type: String },
  fileId:     { type: String }, // Link to File schema if it's an async file
  
  timestamp:  { type: Date,   default: Date.now },
  
  status: {
    type: String,
    enum: ["sent", "delivered", "seen", "failed"],
    default: "sent"
  },
  seenBy: [{ type: String }],
  retryCount: {
    type: Number,
    default: 0
  },
  deliveredAt: {
    type: Date,
    default: null
  },
  seenAt: {
    type: Date,
    default: null
  }
});

// Index for efficient room-history queries
messageSchema.index({ roomId: 1, timestamp: -1 });

module.exports = mongoose.model('Message', messageSchema);
