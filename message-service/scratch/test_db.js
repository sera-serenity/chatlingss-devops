require('dotenv').config();
const mongoose = require('mongoose');
const DrawingEvent = require('../models/DrawingEvent');

async function test() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');
    
    const testEvent = await DrawingEvent.create({
      roomId: 'test-room',
      userId: 'test-user',
      type: 'stroke',
      data: {
        points: [{x:0, y:0}, {x:10, y:10}],
        color: '#ff0000',
        size: 5
      }
    });
    
    console.log('✅ Created test drawing event:', testEvent._id);
    process.exit(0);
  } catch (err) {
    console.error('❌ Test failed:', err);
    process.exit(1);
  }
}

test();
