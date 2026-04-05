const { Payment, Order, Appointment, User } = require('../models');
const { ROLES, APPOINTMENT_STATUS } = require('../config/constants');
const { sendNotification } = require('../socket/socket');
const { createOrUnlockAppointmentChat } = require('../utils/appointmentFlow');

const Razorpay = require('razorpay');
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || 'your_key_id',
  key_secret: process.env.RAZORPAY_KEY_SECRET || 'your_key_secret'
});

exports.createOrder = async (req, res, next) => {
  try {
    const { amount, currency = 'INR', type } = req.body;

    const razorpayOrder = await razorpay.orders.create({
      amount: amount * 100,
      currency,
      receipt: `receipt_${Date.now()}`
    });

    const payment = await Payment.create({
      user: req.user.id,
      amount,
      currency,
      method: type === 'cod' ? 'cod' : 'razorpay',
      razorpayOrderId: razorpayOrder.id
    });

    res.json({
      success: true,
      orderId: razorpayOrder.id,
      payment
    });
  } catch (error) {
    next(error);
  }
};

exports.verifyPayment = async (req, res, next) => {
  try {
    const { razorpayPaymentId, razorpayOrderId, razorpaySignature, orderId, appointmentId, type } = req.body;

    const body = razorpayOrderId + '|' + razorpayPaymentId;
    const crypto = require('crypto');
    const expectedSignature = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || 'your_key_secret')
      .update(body)
      .digest('hex');

    if (expectedSignature !== razorpaySignature) {
      return res.status(400).json({
        success: false,
        message: 'Payment verification failed'
      });
    }

    const payment = await Payment.findOneAndUpdate(
      { razorpayOrderId },
      {
        status: 'completed',
        razorpayPaymentId,
        razorpaySignature,
        transactionId: razorpayPaymentId
      },
      { new: true }
    );

    if (type === 'appointment' && appointmentId) {
      const appointment = await Appointment.findByIdAndUpdate(
        appointmentId,
        { paymentStatus: 'paid' },
        { new: true }
      );

      if (appointment) {
        if (appointment.status === APPOINTMENT_STATUS.ACCEPTED) {
          appointment.status = APPOINTMENT_STATUS.CONFIRMED;
          await appointment.save();
          await createOrUnlockAppointmentChat(appointment._id);
        }

        await sendNotification(
          appointment.patient,
          'Payment Successful',
          'Your consultation payment has been recorded.',
          'payment',
          appointment._id
        );

        await sendNotification(
          appointment.doctor,
          'Consultation Paid',
          'A patient completed payment for an appointment request.',
          'payment',
          appointment._id
        );
      }
    }

    if (type === 'order' && orderId) {
      await Order.findByIdAndUpdate(orderId, {
        paymentStatus: 'paid',
        status: 'confirmed',
        paymentId: razorpayPaymentId
      });
    }

    res.json({
      success: true,
      payment,
      message: 'Payment verified successfully'
    });
  } catch (error) {
    next(error);
  }
};

exports.createAppointmentPayment = async (req, res, next) => {
  try {
    const { appointmentId } = req.body;

    const appointment = await Appointment.findById(appointmentId);

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    if (appointment.patient.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized'
      });
    }

    if (![APPOINTMENT_STATUS.ACCEPTED, APPOINTMENT_STATUS.CONFIRMED].includes(appointment.status)) {
      return res.status(400).json({
        success: false,
        message: 'Payment becomes available after the doctor accepts the request'
      });
    }

    if (appointment.fee <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid appointment fee. Please contact support.'
      });
    }

    const razorpayOrder = await razorpay.orders.create({
      amount: appointment.fee * 100,
      currency: 'INR',
      receipt: `appointment_${appointmentId}`
    });

    const payment = await Payment.create({
      user: req.user.id,
      appointment: appointmentId,
      amount: appointment.fee,
      method: 'razorpay',
      razorpayOrderId: razorpayOrder.id
    });

    res.json({
      success: true,
      orderId: razorpayOrder.id,
      payment
    });
  } catch (error) {
    next(error);
  }
};

exports.createOrderPayment = async (req, res, next) => {
  try {
    const { orderId } = req.body;

    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    if (order.user.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized'
      });
    }

    if (order.totalAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid order amount. Please contact support.'
      });
    }

    const razorpayOrder = await razorpay.orders.create({
      amount: order.totalAmount * 100,
      currency: 'INR',
      receipt: `order_${orderId}`
    });

    const payment = await Payment.create({
      user: req.user.id,
      order: orderId,
      amount: order.totalAmount,
      razorpayOrderId: razorpayOrder.id
    });

    res.json({
      success: true,
      orderId: razorpayOrder.id,
      payment
    });
  } catch (error) {
    next(error);
  }
};

exports.getPayments = async (req, res, next) => {
  try {
    const { status, type } = req.query;

    let query = { user: req.user.id };
    if (status) {
      query.status = status;
    }
    if (type === 'appointment') {
      query.appointment = { $exists: true };
    } else if (type === 'order') {
      query.order = { $exists: true };
    }

    const payments = await Payment.find(query)
      .populate('appointment')
      .populate('order')
      .sort('-createdAt');

    res.json({
      success: true,
      payments
    });
  } catch (error) {
    next(error);
  }
};

exports.getPaymentDetails = async (req, res, next) => {
  try {
    const { id } = req.params;

    const payment = await Payment.findById(id)
      .populate('appointment')
      .populate('order')
      .populate('user', 'name email');

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    if (payment.user._id.toString() !== req.user.id && req.user.role !== ROLES.ADMIN) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized'
      });
    }

    res.json({
      success: true,
      payment
    });
  } catch (error) {
    next(error);
  }
};

exports.refundPayment = async (req, res, next) => {
  try {
    const { id } = req.params;

    const payment = await Payment.findById(id);

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    if (payment.status !== 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Payment cannot be refunded'
      });
    }

    try {
      const refund = await razorpay.payments.refund(payment.razorpayPaymentId, {
        amount: payment.amount * 100
      });

      payment.status = 'refunded';
      await payment.save();

      if (payment.appointment) {
        await Appointment.findByIdAndUpdate(payment.appointment, {
          paymentStatus: 'refunded'
        });
      }

      if (payment.order) {
        await Order.findByIdAndUpdate(payment.order, {
          paymentStatus: 'refunded',
          status: 'cancelled'
        });
      }

      res.json({
        success: true,
        payment,
        refund
      });
    } catch (refundError) {
      payment.status = 'refunded';
      await payment.save();

      res.json({
        success: true,
        payment,
        message: 'Refund initiated'
      });
    }
  } catch (error) {
    next(error);
  }
};
