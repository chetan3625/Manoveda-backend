const express = require('express');
const router = express.Router();
const { chatController } = require('../controllers');
const { protect } = require('../middleware/auth');

router.use(protect);

router.post('/chats', chatController.createChat);
router.get('/chats', chatController.getChats);
router.get('/chats/:chatId/messages', chatController.getMessages);
router.post('/chats/:chatId/messages', chatController.sendMessage);
router.delete('/messages/:messageId', chatController.deleteMessage);
router.post('/group', chatController.createGroup);
router.post('/group/:chatId/members', chatController.addGroupMember);
router.delete('/group/:chatId/members/:userId', chatController.removeGroupMember);
router.get('/search', chatController.searchUsers);

module.exports = router;