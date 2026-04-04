require('dotenv').config();
const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const mongoUrl = process.env.MONGODB_URL || 'mongodb+srv://chetan:chetan3625@chetan.av9qawd.mongodb.net/CHETAN?appName=CHETAN&w=majority';
    console.log('Connecting to MongoDB...');
    const conn = await mongoose.connect(mongoUrl);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`MongoDB Error: ${error.message}`);
    console.error('Make sure:\n1. MongoDB Atlas cluster is not paused\n2. Your IP is whitelisted in Atlas\n3. Username/password is correct');
    process.exit(1);
  }
};

module.exports = connectDB;