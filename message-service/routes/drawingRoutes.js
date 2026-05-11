const express = require('express');
const router = express.Router();
const { saveDrawingEvent, getDrawingHistory, clearDrawingHistory } = require('../controllers/drawingController');

router.post('/', saveDrawingEvent);
router.get('/:room', getDrawingHistory);
router.delete('/:room', clearDrawingHistory);

module.exports = router;
