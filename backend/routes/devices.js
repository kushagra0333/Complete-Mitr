import express from 'express';
import {
  linkDevice,
  getMyDevices,
  getDeviceInfo,
  updateDevice,
  deleteDevice,
  triggerDevice,
  stopTrigger,
  checkDeviceStatus,
  addEmergencyContact,
  removeEmergencyContact,
  updateEmergencyContact,
  postLocationData,
  getDeviceData,
  getTriggerHistory,
  getTriggerEvent,
  resolveTriggerEvent,
  checkTriggerWord
} from '../controllers/deviceController.js';
import { protect } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.use(protect);

router.route('/')
  .post(linkDevice)
  .get(getMyDevices);

router.route('/:deviceId')
  .get(getDeviceInfo)
  .patch(updateDevice)
  .delete(deleteDevice);

router.route('/:deviceId/trigger')
  .post(triggerDevice)
  .delete(stopTrigger);

router.get('/:deviceId/status', checkDeviceStatus);

router.post('/:deviceId/check-trigger-word', checkTriggerWord);
router.post('/:deviceId/location', postLocationData);

router.route('/:deviceId/emergency-contacts')
  .post(addEmergencyContact);

router.route('/:deviceId/emergency-contacts/:contactId')
  .patch(updateEmergencyContact)
  .delete(removeEmergencyContact);

router.route('/:deviceId/data')
  .get(getDeviceData);

router.route('/:deviceId/trigger-history')
  .get(getTriggerHistory);

router.route('/:deviceId/trigger-history/:eventId')
  .get(getTriggerEvent)
  .patch(resolveTriggerEvent);

export default router;