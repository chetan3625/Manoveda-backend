require('dotenv').config();
const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const mongoUrl = process.env.MONGODB_URL || 'mongodb+srv://chetan:chetan3625@chetan.av9qawd.mongodb.net/CHETAN?appName=CHETAN&w=majority';
    console.log('Connecting to MongoDB...');
    const conn = await mongoose.connect(mongoUrl, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`MongoDB Error: ${error.message}`);
    console.log('Note: Server will continue without database until connection is restored');
  }
};

module.exports = connectDB;