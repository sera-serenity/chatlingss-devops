const express = require('express');
const router = express.Router();
const { upload } = require('../src/utils/s3');
const { randomUUID } = require('crypto');
const File = require('../models/File');
const { fileQueue } = require('../src/queues/fileQueue');

router.post('/upload', (req, res) => {
  console.log('Received upload request:', req.file ? 'file present' : 'no file yet');
  upload.single('file')(req, res, async function (err) {
    if (err) {
      console.error('S3 Upload Error:', err);
      return res.status(500).json({ error: err.message, code: err.code });
    }
    if (!req.file) {
      console.warn('Upload failed: No file in request');
      return res.status(400).json({ error: 'No file uploaded' });
    }
    console.log('Upload successful to S3:', req.file.location);

    try {
      const fileId = randomUUID();
      const userId = req.body.userId || 'anonymous';
      const roomId = req.body.roomId || 'global';

      const fileDoc = await File.create({
        fileId,
        userId,
        roomId,
        fileUrl: req.file.location,
        fileName: req.file.originalname,
        fileType: req.file.mimetype,
        status: "uploaded"
      });

      // Push job to queue
      await fileQueue.add('process-file', {
        fileId: fileDoc.fileId,
        fileUrl: fileDoc.fileUrl,
        fileType: fileDoc.fileType
      }, {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000
        }
      });

      res.json({
        fileId: fileDoc.fileId,
        url: fileDoc.fileUrl,
        name: fileDoc.fileName,
        type: fileDoc.fileType,
        size: req.file.size,
        status: fileDoc.status
      });
    } catch (dbErr) {
      console.error('Failed to save file info or queue job:', dbErr);
      res.status(500).json({ error: 'Failed to process file upload' });
    }
  });
});

module.exports = router;
