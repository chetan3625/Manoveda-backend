require('dotenv').config();
const mongoose = require('mongoose');

const connectDB = async () => {
  const mongoUrl = process.env.MONGODB_URL || 'mongodb+srv://chetan:chetan3625@chetan.av9qawd.mongodb.net/?appName=CHETAN';

  if (!mongoUrl) {
    throw new Error('MONGODB_URL is missing');
  }

  console.log('Connecting to MongoDB...');
  mongoose.set('bufferCommands', false);

  const conn = await mongoose.connect(mongoUrl, {
    serverSelectionTimeoutMS: 10000,
  });

  console.log(`MongoDB Connected: ${conn.connection.host}`);
  return conn;
};

module.exports = connectDB;
