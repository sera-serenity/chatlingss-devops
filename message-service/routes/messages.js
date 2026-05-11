const express = require('express');
const router = express.Router();
const { saveMessage, getMessages, getAllMessages, updateStatus, updateRetryCount } = require('../controllers/messageController');

router.post('/',           saveMessage);
router.get('/',            getAllMessages);
router.get('/:room',       getMessages);
router.patch('/:messageId/status', updateStatus);
router.patch('/:messageId/retry', updateRetryCount);

module.exports = router;
