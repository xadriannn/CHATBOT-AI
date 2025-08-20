import express from 'express';
import { addAdmin, getAdminList, deleteAdmin } from '../controllers/adminController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { deleteUser, getUserList, getUserData, updateProfile } from '../controllers/userController.js';
import { uploadFile, uploadedFile, deleteFile } from '../controllers/fileController.js';

import { upload } from '../config/multer.js';
import { createFaqs, deleteFaq, getFaqs, updateFaq } from '../controllers/faqController.js';

const router = express.Router();


router.get('/admin-list', authenticate, getAdminList);
router.post('/add-admin', authenticate, addAdmin);
router.post('/delete-admin', authenticate, deleteAdmin);
router.get('/users', authenticate, getUserList)
router.post('/delete-user', authenticate, deleteUser);
router.get("/get-user-data", authenticate, getUserData);
router.post("/update-profile", authenticate, updateProfile);
router.get('/files', authenticate, uploadedFile);
router.post("/upload-multiple", upload.array("files"), uploadFile);
router.delete('/files/:filename', authenticate, deleteFile);
router.get('/faq', getFaqs);
router.post('/create-faq', authenticate, createFaqs);
router.post('/delete-faq', authenticate, deleteFaq);
router.put('/update-faq', authenticate, updateFaq);
export default router;
