const { Appointment, Chat } = require('../models');
const { APPOINTMENT_STATUS } = require('../config/constants');

const createOrUnlockAppointmentChat = async (appointmentId) => {
  const appointment = await Appointment.findById(appointmentId);
  if (!appointment) {
    return null;
  }

  let chat = appointment.chat ? await Chat.findById(appointment.chat) : null;

  if (!chat) {
    chat = await Chat.findOne({
      appointment: appointment._id,
      participants: { $all: [appointment.patient, appointment.doctor] }
    });
  }

  if (!chat) {
    chat = await Chat.create({
      appointment: appointment._id,
      participants: [appointment.patient, appointment.doctor],
      lastMessage: '',
      lastMessageAt: new Date(),
      lastMessageBy: appointment.doctor,
      isUnlocked: true
    });
  } else if (!chat.isUnlocked) {
    chat.isUnlocked = true;
    await chat.save();
  }

  if (!appointment.chat || appointment.chat.toString() !== chat._id.toString()) {
    appointment.chat = chat._id;
    await appointment.save();
  }

  return chat;
};

const canUnlockConsultation = (appointment) => {
  return appointment.status === APPOINTMENT_STATUS.CONFIRMED && appointment.paymentStatus === 'paid';
};

module.exports = {
  createOrUnlockAppointmentChat,
  canUnlockConsultation
};
