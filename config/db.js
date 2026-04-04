require('dotenv').config();
const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const mongoUrl = process.env.MONGODB_URL || 'mongodb+srv://chetan:chetan3625@chetan.av9qawd.mongodb.net/?appName=CHETAN';
    console.log('Connecting to MongoDB...');
    const conn = await mongoose.connect(mongoUrl);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`MongoDB Error: ${error.message}`);
  }
};

module.exports = connectDB;