import mongoose from 'mongoose';

const triggerHistorySchema = new mongoose.Schema({
  device: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Device',
    required: [true, 'Trigger history must belong to a device']
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Trigger history must belong to a user']
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
  triggeredAt: {
    type: Date,
    default: Date.now
  },
  triggerType: {
    type: String,
    enum: ['manual', 'automatic', 'sos'],
    default: 'manual'
  },
  triggerWord: {
    type: String,
    required: false
  },
  resolvedAt: Date,
  status: {
    type: String,
    enum: ['active', 'resolved'],
    default: 'active'
  },
  batteryLevel: Number
}, {
  timestamps: true
});

triggerHistorySchema.index({ device: 1 });
triggerHistorySchema.index({ user: 1 });
triggerHistorySchema.index({ location: '2dsphere' });
triggerHistorySchema.index({ status: 1 });
triggerHistorySchema.index({ triggeredAt: -1 });

const TriggerHistory = mongoose.model('TriggerHistory', triggerHistorySchema);
export default TriggerHistory;