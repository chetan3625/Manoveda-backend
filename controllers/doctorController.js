const { User, Appointment, Chat, Message, Blog, Feedback, Prescription, Notification, Medicine } = require('../models');
const { ROLES } = require('../config/constants');
const { v4: uuidv4 } = require('uuid');

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
    const { status, notes, prescription, meetingLink } = req.body;

    const appointment = await Appointment.findOne({ _id: id, doctor: req.user.id });

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    if (status) appointment.status = status;
    if (notes) appointment.notes = notes;
    if (prescription) appointment.prescription = prescription;
    if (meetingLink) appointment.meetingLink = meetingLink;

    await appointment.save();

    await Notification.create({
      user: appointment.patient,
      title: 'Appointment Updated',
      message: `Your appointment has been ${status}`,
      type: 'appointment',
      referenceId: appointment._id
    });

    res.json({
      success: true,
      appointment
    });
  } catch (error) {
    next(error);
  }
};

exports.createMeetingLink = async (req, res, next) => {
  try {
    const { appointmentId } = req.body;
    const meetingId = uuidv4();
    const meetingLink = `https://meet.manoveda.in/${meetingId}`;

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

    await Notification.create({
      user: appointment.patient,
      title: 'Meeting Link Created',
      message: 'Your doctor has created a meeting link for your appointment',
      type: 'appointment',
      referenceId: appointment._id,
      data: { meetingLink }
    });

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
    const { patientId, appointmentId, medicines, notes, followUpDate } = req.body;

    const prescription = await Prescription.create({
      patient: patientId,
      doctor: req.user.id,
      appointment: appointmentId,
      medicines,
      notes,
      followUpDate
    });

    await Appointment.findByIdAndUpdate(appointmentId, {
      prescription: prescription._id
    });

    await Notification.create({
      user: patientId,
      title: 'New Prescription',
      message: 'Your doctor has written a prescription for you',
      type: 'appointment',
      referenceId: prescription._id
    });

    res.status(201).json({
      success: true,
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
      status: { $in: ['pending', 'confirmed'] }
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