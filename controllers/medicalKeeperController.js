const { User, Medicine, Order, Notification } = require('../models');
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
    const { name, phone, address } = req.body;

    const user = await User.findByIdAndUpdate(req.user.id, {
      name,
      phone,
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

exports.addMedicine = async (req, res, next) => {
  try {
    const { name, category, description, composition, manufacturer, batchNumber, expiryDate, price, discountedPrice, stock, unit, requiresPrescription, imageUrl, dosage, sideEffects, warnings } = req.body;

    const existingMedicine = await Medicine.findOne({ name });
    if (existingMedicine) {
      return res.status(400).json({
        success: false,
        message: 'Medicine already exists'
      });
    }

    const medicine = await Medicine.create({
      name,
      category,
      description,
      composition,
      manufacturer,
      batchNumber,
      expiryDate,
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

exports.updateMedicine = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updateFields = req.body;

    const medicine = await Medicine.findOneAndUpdate(
      { _id: id, addedBy: req.user.id },
      updateFields,
      { new: true, runValidators: true }
    );

    if (!medicine) {
      return res.status(404).json({
        success: false,
        message: 'Medicine not found'
      });
    }

    res.json({
      success: true,
      medicine
    });
  } catch (error) {
    next(error);
  }
};

exports.deleteMedicine = async (req, res, next) => {
  try {
    const { id } = req.params;

    const medicine = await Medicine.findOneAndDelete({ _id: id, addedBy: req.user.id });

    if (!medicine) {
      return res.status(404).json({
        success: false,
        message: 'Medicine not found'
      });
    }

    res.json({
      success: true,
      message: 'Medicine deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

exports.getMedicines = async (req, res, next) => {
  try {
    const { search, category, page = 1, limit = 10 } = req.query;

    const query = { addedBy: req.user.id };
    if (search) {
      query.name = { $regex: search, $options: 'i' };
    }
    if (category) {
      query.category = category;
    }

    const medicines = await Medicine.find(query)
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

exports.getMedicineDetails = async (req, res, next) => {
  try {
    const { id } = req.params;

    const medicine = await Medicine.findOne({ _id: id, addedBy: req.user.id });

    if (!medicine) {
      return res.status(404).json({
        success: false,
        message: 'Medicine not found'
      });
    }

    res.json({
      success: true,
      medicine
    });
  } catch (error) {
    next(error);
  }
};

exports.updateStock = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { stock } = req.body;

    const medicine = await Medicine.findOneAndUpdate(
      { _id: id, addedBy: req.user.id },
      { stock },
      { new: true }
    );

    if (!medicine) {
      return res.status(404).json({
        success: false,
        message: 'Medicine not found'
      });
    }

    res.json({
      success: true,
      medicine
    });
  } catch (error) {
    next(error);
  }
};

exports.getOrders = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;

    const query = { 'items.medicine.addedBy': req.user.id };
    if (status) {
      query.status = status;
    }

    const orders = await Order.find(query)
      .populate('user', 'name email phone')
      .populate('items.medicine')
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .sort('-createdAt');

    const total = await Order.countDocuments(query);

    res.json({
      success: true,
      orders,
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

exports.updateOrderStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, trackLocation } = req.body;

    const order = await Order.findById(id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    if (status) order.status = status;
    if (trackLocation) order.trackLocation = trackLocation;

    if (status === 'delivered') {
      order.deliveredAt = new Date();
    }

    await order.save();

    await Notification.create({
      user: order.user,
      title: 'Order Updated',
      message: `Your order status has been updated to ${status}`,
      type: 'order',
      referenceId: order._id
    });

    res.json({
      success: true,
      order
    });
  } catch (error) {
    next(error);
  }
};

exports.getOrderDetails = async (req, res, next) => {
  try {
    const { id } = req.params;

    const order = await Order.findById(id)
      .populate('user', 'name email phone')
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

exports.getDashboard = async (req, res, next) => {
  try {
    const totalMedicines = await Medicine.countDocuments({ addedBy: req.user.id });
    const lowStockMedicines = await Medicine.find({
      addedBy: req.user.id,
      stock: { $lt: 10 }
    });

    const myOrderIds = await Medicine.find({ addedBy: req.user.id }).select('_id');
    const orderIds = myOrderIds.map(m => m._id);

    const totalOrders = await Order.countDocuments({
      'items.medicine': { $in: orderIds }
    });

    const pendingOrders = await Order.countDocuments({
      'items.medicine': { $in: orderIds },
      status: { $in: ['pending', 'confirmed'] }
    });

    const totalRevenue = await Order.aggregate([
      { $match: { 'items.medicine': { $in: orderIds }, status: 'delivered' } },
      { $unwind: '$items' },
      { $match: { 'items.medicine': { $in: orderIds } } },
      { $group: { _id: null, total: { $sum: '$items.totalPrice' } } }
    ]);

    res.json({
      success: true,
      stats: {
        totalMedicines,
        totalOrders,
        pendingOrders,
        totalRevenue: totalRevenue[0]?.total || 0
      },
      lowStockMedicines
    });
  } catch (error) {
    next(error);
  }
};

exports.getCategories = async (req, res, next) => {
  try {
    const categories = await Medicine.distinct('category', { addedBy: req.user.id });

    res.json({
      success: true,
      categories
    });
  } catch (error) {
    next(error);
  }
};