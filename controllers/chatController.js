const { Chat, Message, User } = require('../models');

exports.createChat = async (req, res, next) => {
  try {
    const { participantId } = req.body;

    const existingChat = await Chat.findOne({
      participants: { $all: [req.user.id, participantId] }
    });

    if (existingChat) {
      return res.json({
        success: true,
        chat: existingChat
      });
    }

    const participant = await User.findById(participantId);
    if (!participant) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const chat = await Chat.create({
      participants: [req.user.id, participantId],
      lastMessage: '',
      lastMessageAt: new Date(),
      lastMessageBy: req.user.id
    });

    res.status(201).json({
      success: true,
      chat
    });
  } catch (error) {
    next(error);
  }
};

exports.getChats = async (req, res, next) => {
  try {
    const chats = await Chat.find({
      participants: req.user.id
    })
      .populate('participants', 'name email role avatar')
      .sort('-lastMessageAt');

    res.json({
      success: true,
      chats
    });
  } catch (error) {
    next(error);
  }
};

exports.getMessages = async (req, res, next) => {
  try {
    const { chatId } = req.params;
    const { page = 1, limit = 50 } = req.query;

    const chat = await Chat.findById(chatId);

    if (!chat) {
      return res.status(404).json({
        success: false,
        message: 'Chat not found'
      });
    }

    if (!chat.participants.includes(req.user.id) && !chat.isGroup) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to access this chat'
      });
    }

    const messages = await Message.find({ chat: chatId })
      .populate('sender', 'name email role avatar')
      .sort('-createdAt')
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Message.countDocuments({ chat: chatId });

    await Message.updateMany(
      { chat: chatId, sender: { $ne: req.user.id } },
      { $addToSet: { readBy: req.user.id } }
    );

    res.json({
      success: true,
      messages,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.sendMessage = async (req, res, next) => {
  try {
    const { chatId } = req.params;
    const { content, messageType = 'text', attachmentUrl } = req.body;

    const chat = await Chat.findById(chatId);

    if (!chat) {
      return res.status(404).json({
        success: false,
        message: 'Chat not found'
      });
    }

    if (!chat.participants.includes(req.user.id) && !chat.isGroup) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to send message to this chat'
      });
    }

    const message = await Message.create({
      chat: chatId,
      sender: req.user.id,
      content,
      messageType,
      attachmentUrl
    });

    chat.lastMessage = content;
    chat.lastMessageAt = new Date();
    chat.lastMessageBy = req.user.id;
    await chat.save();

    const populatedMessage = await Message.findById(message._id)
      .populate('sender', 'name email role avatar');

    res.status(201).json({
      success: true,
      message: populatedMessage
    });
  } catch (error) {
    next(error);
  }
};

exports.deleteMessage = async (req, res, next) => {
  try {
    const { messageId } = req.params;

    const message = await Message.findOneAndDelete({
      _id: messageId,
      sender: req.user.id
    });

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }

    res.json({
      success: true,
      message: 'Message deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

exports.createGroup = async (req, res, next) => {
  try {
    const { name, participantIds } = req.body;

    const participants = [req.user.id, ...participantIds];

    const chat = await Chat.create({
      participants,
      isGroup: true,
      groupName: name,
      admin: req.user.id
    });

    res.status(201).json({
      success: true,
      chat
    });
  } catch (error) {
    next(error);
  }
};

exports.addGroupMember = async (req, res, next) => {
  try {
    const { chatId } = req.params;
    const { userId } = req.body;

    const chat = await Chat.findById(chatId);

    if (!chat || !chat.isGroup) {
      return res.status(404).json({
        success: false,
        message: 'Group not found'
      });
    }

    if (chat.admin.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Only admin can add members'
      });
    }

    if (!chat.participants.includes(userId)) {
      chat.participants.push(userId);
      await chat.save();
    }

    res.json({
      success: true,
      chat
    });
  } catch (error) {
    next(error);
  }
};

exports.removeGroupMember = async (req, res, next) => {
  try {
    const { chatId, userId } = req.params;

    const chat = await Chat.findById(chatId);

    if (!chat || !chat.isGroup) {
      return res.status(404).json({
        success: false,
        message: 'Group not found'
      });
    }

    if (chat.admin.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Only admin can remove members'
      });
    }

    chat.participants = chat.participants.filter(
      p => p.toString() !== userId
    );
    await chat.save();

    res.json({
      success: true,
      chat
    });
  } catch (error) {
    next(error);
  }
};

exports.searchUsers = async (req, res, next) => {
  try {
    const { search } = req.query;

    if (!search) {
      return res.json({
        success: true,
        users: []
      });
    }

    const users = await User.find({
      _id: { $ne: req.user.id },
      $or: [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ]
    }).select('name email role avatar').limit(10);

    res.json({
      success: true,
      users
    });
  } catch (error) {
    next(error);
  }
};