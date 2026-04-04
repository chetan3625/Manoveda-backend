const express = require('express');
const router = express.Router();
const { paymentController } = require('../controllers');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/role');
const { ROLES } = require('../config/constants');

router.use(protect);

router.post('/create-order', paymentController.createOrder);
router.post('/verify', paymentController.verifyPayment);
router.post('/appointment', paymentController.createAppointmentPayment);
router.post('/order', paymentController.createOrderPayment);
router.get('/', paymentController.getPayments);
router.get('/:id', paymentController.getPaymentDetails);
router.post('/:id/refund', protect, authorize(ROLES.ADMIN), paymentController.refundPayment);

module.exports = router;