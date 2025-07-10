import express from 'express';
import {
  submitContactForm,
  getContactSubmissions,
  updateSubmissionStatus,
  getUserSubmissions
} from '../controllers/contactController.js';
import { protect, restrictTo } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.post('/', submitContactForm);

router.use(protect);

router.get('/my-submissions', getUserSubmissions);

router.use(restrictTo('admin'));

router.get('/', getContactSubmissions);
router.patch('/:id/status', updateSubmissionStatus);

export default router;