import mongoose from 'mongoose';

const deviceDataSchema = new mongoose.Schema({
  device: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Device',
    required: [true, 'Data must belong to a device']
  },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      required: true
    },
    coordinates: {
      type: [Number],
      required: true
    },
    address: String
  },
  batteryLevel: Number,
  timestamp: {
    type: Date,
    default: Date.now
  },
  isSOS: {
    type: Boolean,
    default: false
  }
});

deviceDataSchema.index({ location: '2dsphere' });
deviceDataSchema.index({ device: 1, timestamp: -1 });

const DeviceData = mongoose.model('DeviceData', deviceDataSchema);
export default DeviceData;