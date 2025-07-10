import Device from '../models/Device.js';
import User from '../models/User.js';
import DeviceData from '../models/DeviceData.js';
import TriggerHistory from '../models/TriggerHistory.js';
import AppError from '../utils/appError.js';
import { deviceStateManager } from '../utils/deviceState.js';

export const linkDevice = async (req, res, next) => {
  try {
    const { deviceId, name, emergencyContacts } = req.body;
    const existingDevice = await Device.findOne({ deviceId });

    if (existingDevice) {
      return next(new AppError('Device is already linked to another user', 400));
    }

    const newDevice = await Device.create({
      deviceId,
      user: req.user._id,
      name: name || 'My MITR Device',
      emergencyContacts: emergencyContacts || []
    });

    await User.findByIdAndUpdate(req.user._id, {
      $push: { devices: newDevice._id }
    });

    res.status(201).json({
      status: 'success',
      data: { device: newDevice }
    });
  } catch (err) {
    next(err);
  }
};

export const getMyDevices = async (req, res, next) => {
  try {
    const devices = await Device.find({ user: req.user._id })
      .populate('user', 'name email')
      .select('-__v');

    res.status(200).json({
      status: 'success',
      results: devices.length,
      data: { devices }
    });
  } catch (err) {
    next(err);
  }
};

export const getDeviceInfo = async (req, res, next) => {
  try {
    const device = await Device.findOne({
      _id: req.params.deviceId,
      user: req.user._id
    }).populate('user', 'name email');

    if (!device) {
      return next(new AppError('No device found with that ID', 404));
    }

    res.status(200).json({
      status: 'success',
      data: { device }
    });
  } catch (err) {
    next(err);
  }
};

export const updateDevice = async (req, res, next) => {
  try {
    const device = await Device.findOneAndUpdate(
      { _id: req.params.deviceId, user: req.user._id },
      req.body,
      { new: true, runValidators: true }
    );

    if (!device) {
      return next(new AppError('No device found with that ID', 404));
    }

    res.status(200).json({
      status: 'success',
      data: { device }
    });
  } catch (err) {
    next(err);
  }
};

export const deleteDevice = async (req, res, next) => {
  try {
    const device = await Device.findOneAndDelete({
      _id: req.params.deviceId,
      user: req.user._id
    });

    if (!device) {
      return next(new AppError('No device found with that ID', 404));
    }

    await User.findByIdAndUpdate(req.user._id, {
      $pull: { devices: device._id }
    });

    res.status(204).json({ status: 'success', data: null });
  } catch (err) {
    next(err);
  }
};

export const triggerDevice = async (req, res, next) => {
  try {
    const device = await Device.findOne({
      _id: req.params.deviceId,
      user: req.user._id
    });

    if (!device) return next(new AppError('No device found with that ID', 404));

    const location = device.lastLocation?.coordinates || null;

    const history = await deviceStateManager.triggerDevice(
      device._id,
      req.user._id,
      location,
      'manual',
      device.batteryLevel
    );

    res.status(200).json({
      status: 'success',
      message: 'Device triggered successfully',
      data: {
        deviceId: device.deviceId,
        triggered: true,
        triggerHistory: history
      }
    });
  } catch (err) {
    next(err);
  }
};

export const stopTrigger = async (req, res, next) => {
  try {
    const device = await Device.findOne({
      _id: req.params.deviceId,
      user: req.user._id
    });

    if (!device) return next(new AppError('No device found with that ID', 404));

    await deviceStateManager.stopTrigger(device._id);

    res.status(200).json({
      status: 'success',
      message: 'Device trigger stopped',
      data: {
        deviceId: device.deviceId,
        triggered: false
      }
    });
  } catch (err) {
    next(err);
  }
};

export const checkDeviceStatus = async (req, res, next) => {
  try {
    const device = await Device.findOne({
      _id: req.params.deviceId,
      user: req.user._id
    });

    if (!device) return next(new AppError('No device found with that ID', 404));

    const status = deviceStateManager.checkDeviceStatus(device._id);

    res.status(200).json({
      status: 'success',
      data: {
        deviceId: device.deviceId,
        ...status
      }
    });
  } catch (err) {
    next(err);
  }
};

export const checkTriggerWord = async (req, res, next) => {
  try {
    const { message } = req.body;
    const device = await Device.findOne({
      _id: req.params.deviceId,
      user: req.user._id
    }).populate('emergencyContacts');

    if (!device) return next(new AppError('No device found with that ID', 404));

    let triggerWord = null;
    device.emergencyContacts.forEach(contact => {
      contact.triggerWords.forEach(word => {
        if (message.toLowerCase().includes(word.toLowerCase())) {
          triggerWord = word;
        }
      });
    });

    if (!triggerWord) {
      return next(new AppError('No trigger word detected', 400));
    }

    const location = device.lastLocation?.coordinates || null;
    const history = await deviceStateManager.triggerDevice(
      device._id,
      req.user._id,
      location,
      'automatic',
      device.batteryLevel,
      triggerWord
    );

    res.status(200).json({
      status: 'success',
      message: 'Device triggered by emergency word',
      data: {
        deviceId: device.deviceId,
        triggered: true,
        triggerWord,
        triggerHistory: history
      }
    });
  } catch (err) {
    next(err);
  }
};

export const postLocationData = async (req, res, next) => {
  try {
    const { latitude, longitude, batteryLevel, address } = req.body;
    const device = await Device.findOne({
      _id: req.params.deviceId,
      user: req.user._id
    });

    if (!device) return next(new AppError('No device found with that ID', 404));

    if (!deviceStateManager.isDeviceTriggered(device._id)) {
      return next(new AppError('Device must be triggered to post location', 403));
    }

    const location = {
      type: 'Point',
      coordinates: [longitude, latitude],
      address,
      timestamp: Date.now()
    };

    device.lastLocation = location;
    if (batteryLevel) device.batteryLevel = batteryLevel;
    await device.save();

    const data = await DeviceData.create({
      device: device._id,
      location,
      batteryLevel
    });

    res.status(201).json({
      status: 'success',
      data
    });
  } catch (err) {
    next(err);
  }
};

export const addEmergencyContact = async (req, res, next) => {
  try {
    const device = await Device.findOneAndUpdate(
      { _id: req.params.deviceId, user: req.user._id },
      { $push: { emergencyContacts: req.body } },
      { new: true, runValidators: true }
    );

    if (!device) return next(new AppError('No device found with that ID', 404));

    res.status(200).json({ status: 'success', data: { device } });
  } catch (err) {
    next(err);
  }
};

export const removeEmergencyContact = async (req, res, next) => {
  try {
    const device = await Device.findOneAndUpdate(
      { _id: req.params.deviceId, user: req.user._id },
      { $pull: { emergencyContacts: { _id: req.params.contactId } } },
      { new: true }
    );

    if (!device) return next(new AppError('No device found with that ID', 404));

    res.status(200).json({ status: 'success', data: { device } });
  } catch (err) {
    next(err);
  }
};

export const updateEmergencyContact = async (req, res, next) => {
  try {
    const device = await Device.findOne({
      _id: req.params.deviceId,
      user: req.user._id
    });

    if (!device) return next(new AppError('No device found with that ID', 404));

    const contact = device.emergencyContacts.id(req.params.contactId);
    if (!contact) return next(new AppError('No contact found with that ID', 404));

    Object.assign(contact, req.body);
    await device.save();

    res.status(200).json({ status: 'success', data: { device } });
  } catch (err) {
    next(err);
  }
};

export const getTriggerHistory = async (req, res, next) => {
  try {
    const device = await Device.findOne({
      _id: req.params.deviceId,
      user: req.user._id
    });
    if (!device) return next(new AppError('No device found with that ID', 404));

    const page = req.query.page * 1 || 1;
    const limit = req.query.limit * 1 || 20;
    const skip = (page - 1) * limit;

    const filter = { device: device._id };
    if (req.query.status) filter.status = req.query.status;
    if (req.query.triggerType) filter.triggerType = req.query.triggerType;
    if (req.query.startDate || req.query.endDate) {
      filter.triggeredAt = {};
      if (req.query.startDate) filter.triggeredAt.$gte = new Date(req.query.startDate);
      if (req.query.endDate) filter.triggeredAt.$lte = new Date(req.query.endDate);
    }

    const history = await TriggerHistory.find(filter)
      .sort('-triggeredAt')
      .skip(skip)
      .limit(limit);

    const total = await TriggerHistory.countDocuments(filter);

    res.status(200).json({
      status: 'success',
      results: history.length,
      total,
      data: { history }
    });
  } catch (err) {
    next(err);
  }
};

export const getTriggerEvent = async (req, res, next) => {
  try {
    const event = await TriggerHistory.findOne({
      _id: req.params.eventId,
      user: req.user._id
    }).populate('device', 'deviceId name');

    if (!event) return next(new AppError('No trigger event found with that ID', 404));

    res.status(200).json({ status: 'success', data: { event } });
  } catch (err) {
    next(err);
  }
};

export const resolveTriggerEvent = async (req, res, next) => {
  try {
    const event = await TriggerHistory.findOneAndUpdate(
      {
        _id: req.params.eventId,
        user: req.user._id,
        status: 'active'
      },
      {
        status: 'resolved',
        resolvedAt: Date.now()
      },
      { new: true }
    );

    if (!event) return next(new AppError('No active trigger event found with that ID', 404));

    const currentState = deviceStateManager.checkDeviceStatus(event.device);
    if (currentState.triggered && currentState.triggerHistoryId.equals(event._id)) {
      await deviceStateManager.stopTrigger(event.device);
    }

    res.status(200).json({ status: 'success', data: { event } });
  } catch (err) {
    next(err);
  }
};

export const getDeviceData = async (req, res, next) => {
  try {
    const device = await Device.findOne({
      _id: req.params.deviceId,
      user: req.user._id
    });

    if (!device) {
      return next(new AppError('No device found with that ID', 404));
    }

    const data = await DeviceData.find({ device: device._id })
      .sort('-timestamp')
      .limit(100);

    res.status(200).json({
      status: 'success',
      results: data.length,
      data
    });
  } catch (err) {
    next(err);
  }
};
