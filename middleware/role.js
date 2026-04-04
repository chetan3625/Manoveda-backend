const { ROLES } = require('../config/constants');

exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Role ${req.user.role} is not authorized to access this route`
      });
    }
    next();
  };
};

exports.isAdmin = (req, res, next) => {
  if (req.user.role !== ROLES.ADMIN) {
    return res.status(403).json({
      success: false,
      message: 'Admin access required'
    });
  }
  next();
};

exports.isDoctor = (req, res, next) => {
  if (req.user.role !== ROLES.DOCTOR) {
    return res.status(403).json({
      success: false,
      message: 'Doctor access required'
    });
  }
  next();
};

exports.isPatient = (req, res, next) => {
  if (req.user.role !== ROLES.PATIENT) {
    return res.status(403).json({
      success: false,
      message: 'Patient access required'
    });
  }
  next();
};

exports.isMedicalKeeper = (req, res, next) => {
  if (req.user.role !== ROLES.MEDICAL_KEEPER) {
    return res.status(403).json({
      success: false,
      message: 'Medical Keeper access required'
    });
  }
  next();
};