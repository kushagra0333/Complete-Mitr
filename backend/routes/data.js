import express from 'express';
import { apiKeyProtect } from '../middlewares/apiKeyMiddleware.js';
import { postDeviceData, getDeviceData } from '../controllers/dataController.js';
import { protect } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.post('/', apiKeyProtect, postDeviceData);
router.get('/:deviceId', protect, getDeviceData);

export default router;