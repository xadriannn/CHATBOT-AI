import express from 'express';
import { register, loginUser, logoutUser, loginAdmin, loginGoogle, resetPassword } from '../controllers/authController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { chatHandler } from '../controllers/chatController.js';
import { getAdminList } from '../controllers/adminController.js';

const router = express.Router();

router.post('/register', register);
router.post('/login', loginUser);
router.post('/admin', loginAdmin);
router.get('/admin-list', authenticate, getAdminList);
router.get('/logout', logoutUser);
router.post('/chat', authenticate, chatHandler);
router.post('/login-google', loginGoogle);
router.post('/reset-password', resetPassword);

export default router;
