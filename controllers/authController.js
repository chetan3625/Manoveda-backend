const jwt = require('jsonwebtoken');
const { User } = require('../models');
const { JWT_SECRET, JWT_EXPIRE, ROLES } = require('../config/constants');

const generateToken = (id) => {
  return jwt.sign({ id }, JWT_SECRET);
};

exports.register = async (req, res, next) => {
  try {
    const { name, email, password, role, phone, specialization, experience, qualification, consultationFee } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide name, email and password'
      });
    }

    const allowedRoles = [ROLES.DOCTOR, ROLES.PATIENT, ROLES.MEDICAL_KEEPER];
    const userRole = allowedRoles.includes(role) ? role : ROLES.PATIENT;

    // Validate consultation fee for doctors
    if (userRole === ROLES.DOCTOR) {
      if (!consultationFee || consultationFee <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Please provide a valid consultation fee for doctors'
        });
      }
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Email already registered'
      });
    }

    const user = await User.create({
      name,
      email,
      password,
      role: userRole,
      phone,
      specialization,
      experience,
      qualification,
      consultationFee: userRole === ROLES.DOCTOR ? consultationFee : 0
    });

    const token = generateToken(user._id);

    res.status(201).json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password'
      });
    }

    const user = await User.findOne({ email }).select('+password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    const isMatch = await user.matchPassword(password);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    const token = generateToken(user._id);

    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
        phone: user.phone,
        specialization: user.specialization,
        experience: user.experience,
        rating: user.rating,
        isAvailable: user.isAvailable
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);

    res.json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
        phone: user.phone,
        dateOfBirth: user.dateOfBirth,
        gender: user.gender,
        address: user.address,
        specialization: user.specialization,
        experience: user.experience,
        qualification: user.qualification,
        licenseNumber: user.licenseNumber,
        bio: user.bio,
        isAvailable: user.isAvailable,
        consultationFee: user.consultationFee,
        rating: user.rating,
        totalReviews: user.totalReviews,
        isVerified: user.isVerified
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.updateProfile = async (req, res, next) => {
  try {
    const { name, phone, dateOfBirth, gender, address, specialization, experience, qualification, bio, isAvailable, consultationFee } = req.body;

    const updateFields = {
      name,
      phone,
      dateOfBirth,
      gender,
      address,
      specialization,
      experience,
      qualification,
      bio,
      isAvailable,
      consultationFee
    };

    Object.keys(updateFields).forEach(key => {
      if (updateFields[key] === undefined) {
        delete updateFields[key];
      }
    });

    const user = await User.findByIdAndUpdate(req.user.id, updateFields, { new: true, runValidators: true });

    res.json({
      success: true,
      user
    });
  } catch (error) {
    next(error);
  }
};

exports.updatePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(req.user.id).select('+password');

    const isMatch = await user.matchPassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    user.password = newPassword;
    await user.save();

    const token = generateToken(user._id);

    res.json({
      success: true,
      message: 'Password updated successfully',
      token
    });
  } catch (error) {
    next(error);
  }
};