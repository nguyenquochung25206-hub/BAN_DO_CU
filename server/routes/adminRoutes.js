'use strict';

// TV6: API theo hợp đồng REUSE tuần 1. KHÔNG bỏ middleware xác thực.
const router = require('express').Router();
const { verifyToken } = require('../middleware/authMiddleware'); // TV2 sở hữu
const { isAdmin } = require('../middleware/adminMiddleware');
const controller = require('../controllers/adminController');

router.use(verifyToken, isAdmin);

router.get('/stats', controller.getStats);
router.get('/users', controller.listUsers);
router.put('/users/:id', controller.changeUserStatus);
router.get('/products', controller.listProducts);
router.put('/products/:id/approve', controller.approveProduct);
router.put('/products/:id/reject', controller.rejectProduct);
router.delete('/products/:id', controller.deleteProduct);
router.post('/categories', controller.createCategory);
router.put('/categories/:id', controller.updateCategory);

module.exports = router;
