const jwt = require('jsonwebtoken');
const { User, Chat, Message, Notification } = require('../models');
const { JWT_SECRET } = require('../config/constants');

let io;

const initializeSocket = (socketIo) => {
  io = socketIo;

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error('Authentication error'));
      }

      const decoded = jwt.verify(token, JWT_SECRET);
      const user = await User.findById(decoded.id);
      if (!user) {
        return next(new Error('User not found'));
      }

      socket.user = user;
      next();
    } catch (error) {
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.user.name}`);

    socket.join(`user_${socket.user._id}`);

    socket.on('join_chat', async (chatId) => {
      socket.join(`chat_${chatId}`);
    });

    socket.on('leave_chat', async (chatId) => {
      socket.leave(`chat_${chatId}`);
    });

    socket.on('send_message', async (data) => {
      try {
        const { chatId, content, messageType = 'text', attachmentUrl } = data;

        const chat = await Chat.findById(chatId);
        if (!chat) {
          socket.emit('error', { message: 'Chat not found' });
          return;
        }

        const message = await Message.create({
          chat: chatId,
          sender: socket.user._id,
          content,
          messageType,
          attachmentUrl
        });

        chat.lastMessage = content;
        chat.lastMessageAt = new Date();
        chat.lastMessageBy = socket.user._id;
        await chat.save();

        const populatedMessage = await Message.findById(message._id)
          .populate('sender', 'name email role avatar');

        io.to(`chat_${chatId}`).emit('new_message', populatedMessage);

        const otherParticipants = chat.participants.filter(
          p => p.toString() !== socket.user._id.toString()
        );
        otherParticipants.forEach(participantId => {
          io.to(`user_${participantId}`).emit('message_notification', {
            chatId,
            sender: populatedMessage.sender,
            content
          });
        });
      } catch (error) {
        socket.emit('error', { message: error.message });
      }
    });

    socket.on('typing', (data) => {
      const { chatId } = data;
      socket.to(`chat_${chatId}`).emit('user_typing', {
        chatId,
        user: socket.user._id,
        name: socket.user.name
      });
    });

    socket.on('stop_typing', (data) => {
      const { chatId } = data;
      socket.to(`chat_${chatId}`).emit('user_stop_typing', {
        chatId,
        user: socket.user._id
      });
    });

    socket.on('join_video_call', async (data) => {
      const { appointmentId, meetingLink } = data;
      socket.join(`video_${appointmentId}`);
    });

    socket.on('leave_video_call', async (data) => {
      const { appointmentId } = data;
      socket.leave(`video_${appointmentId}`);
    });

    socket.on('video_signal', async (data) => {
      const { appointmentId, signal, to } = data;
      io.to(`video_${appointmentId}`).emit('video_signal', {
        from: socket.user._id,
        signal,
        to
      });
    });

    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.user.name}`);
    });
  });
};

const sendNotification = async (userId, title, message, type, referenceId) => {
  if (io) {
    await Notification.create({
      user: userId,
      title,
      message,
      type,
      referenceId
    });

    io.to(`user_${userId}`).emit('notification', {
      title,
      message,
      type,
      referenceId,
      createdAt: new Date()
    });
  }
};

const sendToChat = async (chatId, event, data) => {
  if (io) {
    io.to(`chat_${chatId}`).emit(event, data);
  }
};

module.exports = {
  initializeSocket,
  sendNotification,
  sendToChat
};