import AppError from '../utils/appError.js';
import Device from '../models/Device.js';

export const checkDeviceOwnership = async (req, res, next) => {
  const device = await Device.findById(req.params.deviceId);
  
  if (
    !device ||
    (device.user.toString() !== req.user.id && req.user.role !== 'admin')
  ) {
    return next(
      new AppError('You do not have permission to access this device', 403)
    );
  }
  
  next();
};