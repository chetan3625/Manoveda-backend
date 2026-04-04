const mongoose = require('mongoose');

const medicineSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  category: {
    type: String,
    required: true
  },
  description: {
    type: String
  },
  composition: {
    type: String
  },
  manufacturer: {
    type: String
  },
  batchNumber: {
    type: String
  },
  expiryDate: {
    type: Date
  },
  price: {
    type: Number,
    required: true
  },
  discountedPrice: {
    type: Number
  },
  stock: {
    type: Number,
    default: 0
  },
  unit: {
    type: String,
    default: 'piece'
  },
  requiresPrescription: {
    type: Boolean,
    default: false
  },
  imageUrl: {
    type: String
  },
  dosage: {
    type: String
  },
  sideEffects: {
    type: String
  },
  warnings: {
    type: String
  },
  addedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Medicine', medicineSchema);