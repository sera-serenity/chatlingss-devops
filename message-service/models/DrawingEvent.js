const mongoose = require('mongoose');
const { randomUUID } = require('crypto');

const drawingEventSchema = new mongoose.Schema({
  eventId:   { type: String, required: true, unique: true, default: randomUUID },
  roomId:    { type: String, required: true, index: true },
  // Not required — JWT payload may expose id or _id; fallback to 'anonymous'
  userId:    { type: String, default: 'anonymous' },
  type:      { type: String, default: 'stroke' },
  data: {
    points: [{ x: Number, y: Number }],
    color:  { type: String },
    size:   { type: Number },
    alpha:  { type: Number },
    eraser: { type: Boolean },
    stamp:  { type: String }
  },
  timestamp: { type: Date, default: Date.now, index: true }
});

// Compound index for efficient room history loading
drawingEventSchema.index({ roomId: 1, timestamp: 1 });

module.exports = mongoose.model('DrawingEvent', drawingEventSchema, 'drawing_events');
