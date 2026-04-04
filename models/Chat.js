const mongoose = require('mongoose');

const chatSchema = new mongoose.Schema({
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  lastMessage: {
    type: String
  },
  lastMessageAt: {
    type: Date
  },
  lastMessageBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  isGroup: {
    type: Boolean,
    default: false
  },
  groupName: {
    type: String
  },
  admin: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Chat', chatSchema);