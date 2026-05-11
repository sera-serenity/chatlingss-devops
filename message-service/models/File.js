const mongoose = require('mongoose');

const fileSchema = new mongoose.Schema({
  fileId: { type: String, required: true, unique: true },
  userId: { type: String, required: true },
  roomId: { type: String, required: true },
  fileUrl: { type: String, required: true },
  fileName: { type: String },
  fileType: { type: String },
  status: {
    type: String,
    enum: ["uploaded", "processing", "processed", "failed"],
    default: "uploaded"
  },
  retryCount: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  processedAt: { type: Date, default: null }
});

fileSchema.index({ roomId: 1, createdAt: -1 });

module.exports = mongoose.model('File', fileSchema);
