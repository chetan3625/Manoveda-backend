const mongoose = require('mongoose');
const { APPOINTMENT_STATUS } = require('../config/constants');

const appointmentSchema = new mongoose.Schema({
  patient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  doctor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  date: {
    type: Date,
    required: true
  },
  time: {
    type: String,
    required: true
  },
  duration: {
    type: Number,
    default: 30
  },
  status: {
    type: String,
    enum: Object.values(APPOINTMENT_STATUS),
    default: APPOINTMENT_STATUS.PENDING
  },
  type: {
    type: String,
    enum: ['video', 'chat', 'audio'],
    default: 'video'
  },
  meetingLink: {
    type: String
  },
  symptoms: {
    type: String
  },
  notes: {
    type: String
  },
  prescription: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Prescription'
  },
  fee: {
    type: Number,
    default: 0
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'refunded'],
    default: 'pending'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Appointment', appointmentSchema);
