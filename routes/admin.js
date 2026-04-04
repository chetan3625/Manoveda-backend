const express = require('express');
const router = express.Router();
const { adminController } = require('../controllers');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/role');
const { ROLES } = require('../config/constants');

router.use(protect);
router.use(authorize(ROLES.ADMIN));

router.get('/dashboard', adminController.getDashboard);
router.get('/users', adminController.getAllUsers);
router.get('/doctors', adminController.getAllDoctors);
router.get('/patients', adminController.getAllPatients);
router.post('/users', adminController.createUser);
router.put('/users/:id', adminController.updateUser);
router.delete('/users/:id', adminController.deleteUser);
router.get('/chats', adminController.getAllChats);
router.delete('/chats/:id', adminController.deleteChat);
router.get('/appointments', adminController.getAllAppointments);
router.delete('/appointments/:id', adminController.deleteAppointment);
router.get('/payments', adminController.getAllPayments);
router.get('/feedbacks', adminController.getAllFeedbacks);
router.delete('/feedbacks/:id', adminController.deleteFeedback);
router.get('/notifications', adminController.getAllNotifications);
router.get('/reports', adminController.getAllReports);
router.get('/blogs', adminController.getAllBlogs);
router.delete('/blogs/:id', adminController.deleteBlog);
router.post('/message', adminController.sendMessage);

module.exports = router;