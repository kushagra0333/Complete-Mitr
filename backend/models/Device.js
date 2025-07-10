import mongoose from 'mongoose';

const emergencyContactSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Emergency contact must have a name'],
    trim: true
  },
  phone: {
    type: String,
    required: [true, 'Emergency contact must have a phone number'],
    trim: true
  },
  email: {
    type: String,
    trim: true,
    lowercase: true
  },
  relationship: {
    type: String,
    trim: true
  },
  triggerWords: {
    type: [String],
    default: ['help', 'emergency', 'sos', 'save me']
  }
});

const deviceSchema = new mongoose.Schema({
  deviceId: {
    type: String,
    required: [true, 'Device ID is required'],
    unique: true,
    trim: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Device must belong to a user']
  },
  name: {
    type: String,
    trim: true,
    default: 'My MITR Device'
  },
  emergencyContacts: [emergencyContactSchema],
  lastLocation: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number],
      default: [0, 0]
    },
    address: String,
    timestamp: Date
  },
  isActive: {
    type: Boolean,
    default: true
  },
  batteryLevel: {
    type: Number,
    min: 0,
    max: 100
  },
  lastHeartbeat: Date
}, {
  timestamps: true
});

deviceSchema.index({ lastLocation: '2dsphere' });

const Device = mongoose.model('Device', deviceSchema);
export default Device;