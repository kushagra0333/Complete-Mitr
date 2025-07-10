import mongoose from 'mongoose';

const emergencyContactSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  phone: {
    type: String,
    required: true,
  },
  relationship: {
    type: String,
    default: '',
  },
  triggerWords: {
    type: [String],
    default: ['help', 'emergency', 'sos', 'save me'],
  },
});

const EmergencyContact = mongoose.model('EmergencyContact', emergencyContactSchema);

export default EmergencyContact;