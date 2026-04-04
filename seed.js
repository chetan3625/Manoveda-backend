const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const connectDB = require('./config/db');
const User = require('./models/User');
require('dotenv').config();

const seedAdmin = async () => {
  await connectDB();

  const adminExists = await User.findOne({ role: 'admin' });
  if (adminExists) {
    console.log('Admin already exists');
    process.exit();
  }

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash('admin123', salt);

  const admin = await User.create({
    name: 'System Admin',
    email: 'admin@manoveda.com',
    password: hashedPassword,
    role: 'admin',
    phone: '1234567890',
    isVerified: true
  });

  console.log('Admin created:', admin.email);
  console.log('Default password: admin123');
  process.exit();
};

seedAdmin();