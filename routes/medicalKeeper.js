const express = require('express');
const router = express.Router();
const { medicalKeeperController } = require('../controllers');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/role');
const { ROLES } = require('../config/constants');

router.use(protect);
router.use(authorize(ROLES.MEDICAL_KEEPER));

router.get('/profile', medicalKeeperController.getProfile);
router.put('/profile', medicalKeeperController.updateProfile);
router.get('/dashboard', medicalKeeperController.getDashboard);
router.get('/analytics', medicalKeeperController.getSalesAnalytics);
router.post('/medicines', medicalKeeperController.addMedicine);
router.put('/medicines/:id', medicalKeeperController.updateMedicine);
router.delete('/medicines/:id', medicalKeeperController.deleteMedicine);
router.get('/medicines', medicalKeeperController.getMedicines);
router.get('/medicines/:id', medicalKeeperController.getMedicineDetails);
router.put('/medicines/:id/stock', medicalKeeperController.updateStock);
router.get('/orders', medicalKeeperController.getOrders);
router.put('/orders/:id', medicalKeeperController.updateOrderStatus);
router.get('/orders/:id', medicalKeeperController.getOrderDetails);
router.get('/categories', medicalKeeperController.getCategories);

module.exports = router;