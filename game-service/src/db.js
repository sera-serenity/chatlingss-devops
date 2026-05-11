const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`✅ Game Service connected to MongoDB: ${conn.connection.host}`);
  } catch (err) {
    console.error(`❌ MongoDB Connection Error: ${err.message}`);
    // Don't exit process in development if DB is not available
    // process.exit(1);
  }
};

module.exports = connectDB;
