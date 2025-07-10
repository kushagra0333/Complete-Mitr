import TriggerHistory from '../models/TriggerHistory.js';

class DeviceStateManager {
  constructor() {
    this.deviceStates = new Map();
    this.emergencyAlerts = new Map();
  }

  async triggerDevice(deviceId, userId, location, triggerType = 'manual', batteryLevel, triggerWord = null) {
    const history = await TriggerHistory.create({
      device: deviceId,
      user: userId,
      location: {
        type: 'Point',
        coordinates: location || [0, 0],
        address: 'Unknown location'
      },
      triggerType,
      batteryLevel,
      status: 'active',
      triggerWord
    });

    this.deviceStates.set(deviceId, {
      triggered: true,
      lastTriggered: new Date(),
      triggerHistoryId: history._id,
      location: history.location
    });

    return history;
  }

  async stopTrigger(deviceId) {
    const state = this.deviceStates.get(deviceId);
    if (state && state.triggerHistoryId) {
      await TriggerHistory.findByIdAndUpdate(state.triggerHistoryId, {
        status: 'resolved',
        resolvedAt: new Date()
      });
    }

    this.deviceStates.delete(deviceId);
  }

  checkDeviceStatus(deviceId) {
    const state = this.deviceStates.get(deviceId);
    if (!state) {
      return {
        triggered: false,
        lastTriggered: null,
        isActive: false
      };
    }

    return {
      triggered: state.triggered,
      lastTriggered: state.lastTriggered,
      isActive: true,
      triggerHistoryId: state.triggerHistoryId,
      location: state.location
    };
  }

  isDeviceTriggered(deviceId) {
    return this.deviceStates.has(deviceId);
  }

  async triggerEmergencyAlert(deviceId, userId, location, contacts, batteryLevel) {
    const history = await TriggerHistory.create({
      device: deviceId,
      user: userId,
      location: {
        type: 'Point',
        coordinates: location || [0, 0],
        address: 'Emergency location'
      },
      triggerType: 'sos',
      batteryLevel,
      status: 'active'
    });

    this.emergencyAlerts.set(deviceId, {
      triggeredAt: new Date(),
      contactsNotified: contacts,
      resolved: false,
      triggerHistoryId: history._id
    });

    return history;
  }

  async resolveEmergencyAlert(deviceId) {
    const alert = this.emergencyAlerts.get(deviceId);
    if (alert && alert.triggerHistoryId) {
      await TriggerHistory.findByIdAndUpdate(alert.triggerHistoryId, {
        status: 'resolved',
        resolvedAt: new Date()
      });

      alert.resolved = true;
      this.emergencyAlerts.set(deviceId, alert);
    }
  }

  getEmergencyAlertStatus(deviceId) {
    return this.emergencyAlerts.get(deviceId) || null;
  }
}

export const deviceStateManager = new DeviceStateManager();