const { User, Appointment, Chat, Message, Blog, Feedback, Prescription, Notification, Medicine } = require('../models');
const { ROLES, APPOINTMENT_STATUS } = require('../config/constants');
const { v4: uuidv4 } = require('uuid');
const { sendNotification } = require('../socket/socket');
const { createOrUnlockAppointmentChat } = require('../utils/appointmentFlow');
const { generatePrescriptionPdf } = require('../utils/pdfGenerator');

exports.getProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);

    res.json({
      success: true,
      user
    });
  } catch (error) {
    next(error);
  }
};

exports.updateProfile = async (req, res, next) => {
  try {
    const { specialization, experience, qualification, bio, isAvailable, consultationFee, licenseNumber } = req.body;

    const user = await User.findByIdAndUpdate(req.user.id, {
      specialization,
      experience,
      qualification,
      bio,
      isAvailable,
      consultationFee,
      licenseNumber
    }, { new: true, runValidators: true });

    res.json({
      success: true,
      user
    });
  } catch (error) {
    next(error);
  }
};

exports.getPatients = async (req, res, next) => {
  try {
    const appointments = await Appointment.find({ doctor: req.user.id })
      .populate('patient', 'name email avatar phone dateOfBirth gender')
      .sort('-createdAt');

    const patients = appointments.map(apt => apt.patient);
    const uniquePatients = [...new Map(patients.map(p => [p._id.toString(), p])).values()];

    res.json({
      success: true,
      patients: uniquePatients
    });
  } catch (error) {
    next(error);
  }
};

exports.getAppointments = async (req, res, next) => {
  try {
    const { status, date } = req.query;

    const query = { doctor: req.user.id };
    if (status) {
      query.status = status;
    }
    if (date) {
      const startDate = new Date(date);
      const endDate = new Date(date);
      endDate.setDate(endDate.getDate() + 1);
      query.date = { $gte: startDate, $lt: endDate };
    }

    const appointments = await Appointment.find(query)
      .populate('patient', 'name email avatar phone')
      .populate('chat')
      .populate('prescription')
      .sort('date time');

    res.json({
      success: true,
      appointments
    });
  } catch (error) {
    next(error);
  }
};

exports.updateAppointment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, notes, prescription, meetingLink, rejectionReason } = req.body;

    const appointment = await Appointment.findOne({ _id: id, doctor: req.user.id });

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    if (status) {
      appointment.status = status;
      appointment.doctorDecisionAt = new Date();
      if (status === APPOINTMENT_STATUS.REJECTED) {
        appointment.rejectionReason = rejectionReason || 'Doctor rejected the request';
      }
      if (status === APPOINTMENT_STATUS.ACCEPTED && appointment.paymentStatus === 'paid') {
        appointment.status = APPOINTMENT_STATUS.CONFIRMED;
      }
    }
    if (notes) appointment.notes = notes;
    if (prescription) appointment.prescription = prescription;
    if (meetingLink) appointment.meetingLink = meetingLink;

    await appointment.save();

    if (appointment.status === APPOINTMENT_STATUS.CONFIRMED) {
      const chat = await createOrUnlockAppointmentChat(appointment._id);
      if (chat) {
        appointment.chat = chat._id;
        await appointment.save();
      }
    }

    const statusMessage = appointment.status === APPOINTMENT_STATUS.REJECTED
      ? `Your appointment request was rejected. ${appointment.rejectionReason || ''}`.trim()
      : appointment.status === APPOINTMENT_STATUS.ACCEPTED
        ? 'Your doctor accepted the request. Complete payment to unlock chat and consultation.'
        : appointment.status === APPOINTMENT_STATUS.CONFIRMED
          ? 'Your appointment is confirmed. Chat and consultation are now unlocked.'
          : `Your appointment has been updated to ${appointment.status}.`;

    await sendNotification(
      appointment.patient,
      'Appointment Updated',
      statusMessage,
      'appointment',
      appointment._id
    );

    res.json({
      success: true,
      message: 'Appointment updated successfully',
      appointment
    });
  } catch (error) {
    next(error);
  }
};

exports.createMeetingLink = async (req, res, next) => {
  try {
    const { appointmentId } = req.body;
    const meetingId = `manoveda-${uuidv4()}`;
    const meetingLink = `https://meet.jit.si/${meetingId}`;

    const appointment = await Appointment.findOneAndUpdate(
      { _id: appointmentId, doctor: req.user.id },
      { meetingLink, type: 'video' },
      { new: true }
    );

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    if (appointment.status !== APPOINTMENT_STATUS.CONFIRMED || appointment.paymentStatus !== 'paid') {
      return res.status(400).json({
        success: false,
        message: 'Meeting links can only be created for paid and confirmed appointments'
      });
    }

    await sendNotification(
      appointment.patient,
      'Meeting Link Created',
      'Your doctor created a video consultation link.',
      'appointment',
      appointment._id,
      { meetingLink }
    );

    res.json({
      success: true,
      meetingLink
    });
  } catch (error) {
    next(error);
  }
};

exports.writePrescription = async (req, res, next) => {
  try {
    const { patientId, appointmentId, diagnosis, medicines, notes, followUpDate } = req.body;

    const appointment = await Appointment.findOne({
      _id: appointmentId,
      doctor: req.user.id,
      patient: patientId
    }).populate('patient', 'name').populate('doctor', 'name specialization');

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    if (appointment.status !== APPOINTMENT_STATUS.CONFIRMED && appointment.status !== APPOINTMENT_STATUS.COMPLETED) {
      return res.status(400).json({
        success: false,
        message: 'Prescription can only be generated for accepted paid consultations'
      });
    }

    const prescription = await Prescription.create({
      patient: patientId,
      doctor: req.user.id,
      appointment: appointmentId,
      diagnosis,
      medicines,
      notes,
      followUpDate
    });

    const pdfResult = await generatePrescriptionPdf({
      prescription,
      appointment,
      doctor: {
        name: req.user.name,
        specialization: req.user.specialization
      },
      patient: appointment.patient
    });

    prescription.pdfPath = pdfResult.filePath;
    prescription.pdfUrl = pdfResult.publicUrl;
    await prescription.save();

    await Appointment.findByIdAndUpdate(appointmentId, {
      prescription: prescription._id,
      status: APPOINTMENT_STATUS.COMPLETED
    });

    await sendNotification(
      patientId,
      'New Prescription',
      'Your doctor has uploaded a prescription PDF for this consultation.',
      'appointment',
      prescription._id
    );

    res.status(201).json({
      success: true,
      message: 'Prescription created successfully',
      prescription
    });
  } catch (error) {
    next(error);
  }
};

exports.getPrescriptions = async (req, res, next) => {
  try {
    const { patientId } = req.query;

    const query = { doctor: req.user.id };
    if (patientId) {
      query.patient = patientId;
    }

    const prescriptions = await Prescription.find(query)
      .populate('patient', 'name email')
      .populate('appointment')
      .sort('-createdAt');

    res.json({
      success: true,
      prescriptions
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

    const messages = await Message.find({ chat: chatId })
      .populate('sender', 'name email role avatar')
      .sort('createdAt');

    await Message.updateMany(
      { chat: chatId, sender: { $ne: req.user.id } },
      { $addToSet: { readBy: req.user.id } }
    );

    res.json({
      success: true,
      messages
    });
  } catch (error) {
    next(error);
  }
};

exports.createBlog = async (req, res, next) => {
  try {
    const { title, content, summary, category, tags, imageUrl } = req.body;

    const blog = await Blog.create({
      title,
      content,
      summary,
      author: req.user.id,
      category,
      tags,
      imageUrl
    });

    res.status(201).json({
      success: true,
      blog
    });
  } catch (error) {
    next(error);
  }
};

exports.updateBlog = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updateFields = req.body;

    const blog = await Blog.findOneAndUpdate(
      { _id: id, author: req.user.id },
      updateFields,
      { new: true, runValidators: true }
    );

    if (!blog) {
      return res.status(404).json({
        success: false,
        message: 'Blog not found'
      });
    }

    res.json({
      success: true,
      blog
    });
  } catch (error) {
    next(error);
  }
};

exports.deleteBlog = async (req, res, next) => {
  try {
    const { id } = req.params;

    const blog = await Blog.findOneAndDelete({ _id: id, author: req.user.id });

    if (!blog) {
      return res.status(404).json({
        success: false,
        message: 'Blog not found'
      });
    }

    res.json({
      success: true,
      message: 'Blog deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

exports.getMyBlogs = async (req, res, next) => {
  try {
    const blogs = await Blog.find({ author: req.user.id })
      .populate('author', 'name email')
      .sort('-createdAt');

    res.json({
      success: true,
      blogs
    });
  } catch (error) {
    next(error);
  }
};

exports.getFeedbacks = async (req, res, next) => {
  try {
    const feedbacks = await Feedback.find({ doctor: req.user.id })
      .populate('user', 'name email avatar')
      .sort('-createdAt');

    res.json({
      success: true,
      feedbacks
    });
  } catch (error) {
    next(error);
  }
};

exports.getNotifications = async (req, res, next) => {
  try {
    const notifications = await Notification.find({ user: req.user.id })
      .sort('-createdAt')
      .limit(30);

    res.json({
      success: true,
      notifications
    });
  } catch (error) {
    next(error);
  }
};

exports.markNotificationRead = async (req, res, next) => {
  try {
    const { id } = req.params;

    await Notification.findOneAndUpdate(
      { _id: id, user: req.user.id },
      { isRead: true }
    );

    res.json({
      success: true
    });
  } catch (error) {
    next(error);
  }
};

exports.addMedicine = async (req, res, next) => {
  try {
    const { name, category, description, composition, manufacturer, price, discountedPrice, stock, unit, requiresPrescription, imageUrl, dosage, sideEffects, warnings } = req.body;

    const medicine = await Medicine.create({
      name,
      category,
      description,
      composition,
      manufacturer,
      price,
      discountedPrice,
      stock,
      unit,
      requiresPrescription,
      imageUrl,
      dosage,
      sideEffects,
      warnings,
      addedBy: req.user.id
    });

    res.status(201).json({
      success: true,
      medicine
    });
  } catch (error) {
    next(error);
  }
};

exports.getAvailability = async (req, res, next) => {
  try {
    const { date } = req.query;

    const startDate = new Date(date);
    const endDate = new Date(date);
    endDate.setDate(endDate.getDate() + 1);

    const appointments = await Appointment.find({
      doctor: req.user.id,
      date: { $gte: startDate, $lt: endDate },
      status: { $in: [APPOINTMENT_STATUS.PENDING, APPOINTMENT_STATUS.ACCEPTED, APPOINTMENT_STATUS.CONFIRMED] }
    }).select('date time');

    const bookedSlots = appointments.map(apt => apt.time);

    res.json({
      success: true,
      bookedSlots
    });
  } catch (error) {
    next(error);
  }
};
