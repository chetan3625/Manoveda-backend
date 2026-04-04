const { User, Appointment, Chat, Message, Blog, Feedback, Order, Prescription, Notification, Medicine, Payment } = require('../models');
const { ROLES } = require('../config/constants');

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
    const { name, phone, dateOfBirth, gender, address } = req.body;

    const user = await User.findByIdAndUpdate(req.user.id, {
      name,
      phone,
      dateOfBirth,
      gender,
      address
    }, { new: true, runValidators: true });

    res.json({
      success: true,
      user
    });
  } catch (error) {
    next(error);
  }
};

exports.getDoctors = async (req, res, next) => {
  try {
    const { search, specialization, page = 1, limit = 10 } = req.query;

    const query = { role: ROLES.DOCTOR, isAvailable: true };
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { specialization: { $regex: search, $options: 'i' } }
      ];
    }
    if (specialization) {
      query.specialization = specialization;
    }

    const doctors = await User.find(query)
      .select('-password')
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .sort('-rating');

    const total = await User.countDocuments(query);

    res.json({
      success: true,
      doctors,
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

exports.getDoctorProfile = async (req, res, next) => {
  try {
    const { id } = req.params;

    const doctor = await User.findById(id).select('-password');

    if (!doctor || doctor.role !== ROLES.DOCTOR) {
      return res.status(404).json({
        success: false,
        message: 'Doctor not found'
      });
    }

    const feedbacks = await Feedback.find({ doctor: id, isApproved: true })
      .populate('user', 'name avatar')
      .limit(5);

    res.json({
      success: true,
      doctor,
      feedbacks
    });
  } catch (error) {
    next(error);
  }
};

exports.bookAppointment = async (req, res, next) => {
  try {
    const { doctorId, date, time, duration, type, symptoms } = req.body;

    const doctor = await User.findById(doctorId);
    if (!doctor || doctor.role !== ROLES.DOCTOR) {
      return res.status(404).json({
        success: false,
        message: 'Doctor not found'
      });
    }

    const existingAppointment = await Appointment.findOne({
      doctor: doctorId,
      patient: req.user.id,
      date,
      time,
      status: { $in: ['pending', 'confirmed'] }
    });

    if (existingAppointment) {
      return res.status(400).json({
        success: false,
        message: 'Appointment already exists for this time slot'
      });
    }

    const appointment = await Appointment.create({
      patient: req.user.id,
      doctor: doctorId,
      date,
      time,
      duration,
      type,
      symptoms,
      fee: doctor.consultationFee
    });

    const populatedAppointment = await Appointment.findById(appointment._id)
      .populate('doctor', 'name email specialization')
      .populate('patient', 'name email');

    await Notification.create({
      user: doctorId,
      title: 'New Appointment',
      message: 'You have a new appointment request',
      type: 'appointment',
      referenceId: appointment._id
    });

    res.status(201).json({
      success: true,
      appointment: populatedAppointment
    });
  } catch (error) {
    next(error);
  }
};

exports.getAppointments = async (req, res, next) => {
  try {
    const { status } = req.query;

    const query = { patient: req.user.id };
    if (status) {
      query.status = status;
    }

    const appointments = await Appointment.find(query)
      .populate('doctor', 'name email specialization avatar consultationFee')
      .sort('-date -time');

    res.json({
      success: true,
      appointments
    });
  } catch (error) {
    next(error);
  }
};

exports.getAppointmentDetails = async (req, res, next) => {
  try {
    const { id } = req.params;

    const appointment = await Appointment.findOne({ _id: id, patient: req.user.id })
      .populate('doctor', 'name email specialization avatar consultationFee');

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    res.json({
      success: true,
      appointment
    });
  } catch (error) {
    next(error);
  }
};

exports.cancelAppointment = async (req, res, next) => {
  try {
    const { id } = req.params;

    const appointment = await Appointment.findOne({ _id: id, patient: req.user.id });

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    if (appointment.status === 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Cannot cancel completed appointment'
      });
    }

    appointment.status = 'cancelled';
    await appointment.save();

    await Notification.create({
      user: appointment.doctor,
      title: 'Appointment Cancelled',
      message: 'Your patient has cancelled the appointment',
      type: 'appointment',
      referenceId: appointment._id
    });

    res.json({
      success: true,
      message: 'Appointment cancelled successfully'
    });
  } catch (error) {
    next(error);
  }
};

exports.getPrescriptions = async (req, res, next) => {
  try {
    const prescriptions = await Prescription.find({ patient: req.user.id })
      .populate('doctor', 'name email specialization')
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

exports.getBlogs = async (req, res, next) => {
  try {
    const { category, page = 1, limit = 10 } = req.query;

    const query = { isPublished: true };
    if (category) {
      query.category = category;
    }

    const blogs = await Blog.find(query)
      .populate('author', 'name email specialization')
      .select('-comments')
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .sort('-createdAt');

    const total = await Blog.countDocuments(query);

    res.json({
      success: true,
      blogs,
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

exports.getBlogDetails = async (req, res, next) => {
  try {
    const { id } = req.params;

    const blog = await Blog.findByIdAndUpdate(id, { $inc: { views: 1 } }, { new: true })
      .populate('author', 'name email specialization')
      .populate('comments.user', 'name avatar');

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

exports.likeBlog = async (req, res, next) => {
  try {
    const { id } = req.params;

    const blog = await Blog.findById(id);

    if (!blog) {
      return res.status(404).json({
        success: false,
        message: 'Blog not found'
      });
    }

    const likeIndex = blog.likes.indexOf(req.user.id);
    if (likeIndex > -1) {
      blog.likes.splice(likeIndex, 1);
    } else {
      blog.likes.push(req.user.id);
    }

    await blog.save();

    res.json({
      success: true,
      likes: blog.likes.length
    });
  } catch (error) {
    next(error);
  }
};

exports.commentBlog = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { content } = req.body;

    const blog = await Blog.findById(id);

    if (!blog) {
      return res.status(404).json({
        success: false,
        message: 'Blog not found'
      });
    }

    blog.comments.push({
      user: req.user.id,
      content
    });

    await blog.save();

    res.json({
      success: true,
      message: 'Comment added successfully'
    });
  } catch (error) {
    next(error);
  }
};

exports.addFeedback = async (req, res, next) => {
  try {
    const { doctorId, appointmentId, rating, review } = req.body;

    const feedback = await Feedback.create({
      user: req.user.id,
      doctor: doctorId,
      appointment: appointmentId,
      rating,
      review,
      isApproved: false
    });

    const doctor = await User.findById(doctorId);
    if (doctor) {
      const newRating = ((doctor.rating * doctor.totalReviews) + rating) / (doctor.totalReviews + 1);
      doctor.rating = newRating;
      doctor.totalReviews += 1;
      await doctor.save();
    }

    res.status(201).json({
      success: true,
      feedback,
      message: 'Feedback submitted successfully'
    });
  } catch (error) {
    next(error);
  }
};

exports.getMedicines = async (req, res, next) => {
  try {
    const { search, category, page = 1, limit = 10 } = req.query;

    const query = { isActive: true };
    if (search) {
      query.name = { $regex: search, $options: 'i' };
    }
    if (category) {
      query.category = category;
    }

    const medicines = await Medicine.find(query)
      .populate('addedBy', 'name')
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .sort('-createdAt');

    const total = await Medicine.countDocuments(query);

    res.json({
      success: true,
      medicines,
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

exports.addToCart = async (req, res, next) => {
  try {
    const { medicineId, quantity = 1 } = req.body;

    const medicine = await Medicine.findById(medicineId);

    if (!medicine) {
      return res.status(404).json({
        success: false,
        message: 'Medicine not found'
      });
    }

    let order = await Order.findOne({
      user: req.user.id,
      status: 'pending',
      paymentStatus: 'pending'
    });

    if (!order) {
      order = await Order.create({
        user: req.user.id,
        items: [],
        totalAmount: 0,
        shippingAddress: {}
      });
    }

    const existingItemIndex = order.items.findIndex(
      item => item.medicine.toString() === medicineId
    );

    if (existingItemIndex > -1) {
      order.items[existingItemIndex].quantity += quantity;
      order.items[existingItemIndex].totalPrice =
        order.items[existingItemIndex].quantity * order.items[existingItemIndex].price;
    } else {
      order.items.push({
        medicine: medicineId,
        name: medicine.name,
        quantity,
        price: medicine.discountedPrice || medicine.price,
        totalPrice: (medicine.discountedPrice || medicine.price) * quantity
      });
    }

    order.totalAmount = order.items.reduce((sum, item) => sum + item.totalPrice, 0);

    await order.save();

    res.json({
      success: true,
      order
    });
  } catch (error) {
    next(error);
  }
};

exports.getCart = async (req, res, next) => {
  try {
    const order = await Order.findOne({
      user: req.user.id,
      status: 'pending',
      paymentStatus: 'pending'
    }).populate('items.medicine');

    res.json({
      success: true,
      order
    });
  } catch (error) {
    next(error);
  }
};

exports.updateCartItem = async (req, res, next) => {
  try {
    const { itemId, quantity } = req.body;

    const order = await Order.findOne({
      user: req.user.id,
      status: 'pending',
      'items._id': itemId
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Item not found in cart'
      });
    }

    const itemIndex = order.items.findIndex(item => item._id.toString() === itemId);
    if (quantity <= 0) {
      order.items.splice(itemIndex, 1);
    } else {
      order.items[itemIndex].quantity = quantity;
      order.items[itemIndex].totalPrice =
        quantity * order.items[itemIndex].price;
    }

    order.totalAmount = order.items.reduce((sum, item) => sum + item.totalPrice, 0);

    await order.save();

    res.json({
      success: true,
      order
    });
  } catch (error) {
    next(error);
  }
};

exports.removeCartItem = async (req, res, next) => {
  try {
    const { itemId } = req.params;

    const order = await Order.findOne({
      user: req.user.id,
      status: 'pending'
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    order.items = order.items.filter(item => item._id.toString() !== itemId);
    order.totalAmount = order.items.reduce((sum, item) => sum + item.totalPrice, 0);

    await order.save();

    res.json({
      success: true,
      order
    });
  } catch (error) {
    next(error);
  }
};

exports.placeOrder = async (req, res, next) => {
  try {
    const { shippingAddress, paymentMethod } = req.body;

    const order = await Order.findOne({
      user: req.user.id,
      status: 'pending',
      paymentStatus: 'pending'
    });

    if (!order || order.items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Cart is empty'
      });
    }

    order.shippingAddress = shippingAddress;
    order.paymentMethod = paymentMethod || 'online';
    order.status = 'confirmed';

    await order.save();

    for (const item of order.items) {
      await Medicine.findByIdAndUpdate(item.medicine, {
        $inc: { stock: -item.quantity }
      });
    }

    res.json({
      success: true,
      order,
      message: 'Order placed successfully'
    });
  } catch (error) {
    next(error);
  }
};

exports.getOrders = async (req, res, next) => {
  try {
    const { status } = req.query;

    const query = { user: req.user.id };
    if (status) {
      query.status = status;
    }

    const orders = await Order.find(query)
      .populate('items.medicine')
      .sort('-createdAt');

    res.json({
      success: true,
      orders
    });
  } catch (error) {
    next(error);
  }
};

exports.getOrderDetails = async (req, res, next) => {
  try {
    const { id } = req.params;

    const order = await Order.findOne({ _id: id, user: req.user.id })
      .populate('items.medicine');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    res.json({
      success: true,
      order
    });
  } catch (error) {
    next(error);
  }
};

exports.getNotifications = async (req, res, next) => {
  try {
    const { page = 1, limit = 10 } = req.query;

    const notifications = await Notification.find({ user: req.user.id })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .sort('-createdAt');

    const total = await Notification.countDocuments({ user: req.user.id });

    res.json({
      success: true,
      notifications,
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