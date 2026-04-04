const express = require('express');
const router = express.Router();
const { doctorController } = require('../controllers');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/role');
const { ROLES } = require('../config/constants');

router.use(protect);
router.use(authorize(ROLES.DOCTOR));

router.get('/profile', doctorController.getProfile);
router.put('/profile', doctorController.updateProfile);
router.get('/patients', doctorController.getPatients);
router.get('/appointments', doctorController.getAppointments);
router.put('/appointments/:id', doctorController.updateAppointment);
router.post('/meeting-link', doctorController.createMeetingLink);
router.post('/prescription', doctorController.writePrescription);
router.get('/prescriptions', doctorController.getPrescriptions);
router.get('/chats', doctorController.getChats);
router.get('/chats/:chatId/messages', doctorController.getMessages);
router.post('/blogs', doctorController.createBlog);
router.put('/blogs/:id', doctorController.updateBlog);
router.delete('/blogs/:id', doctorController.deleteBlog);
router.get('/blogs', doctorController.getMyBlogs);
router.get('/feedbacks', doctorController.getFeedbacks);
router.post('/medicines', doctorController.addMedicine);
router.get('/availability', doctorController.getAvailability);

module.exports = router;