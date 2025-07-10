import crypto from 'crypto';

export const createPasswordResetToken = () => {
  const resetToken = crypto.randomBytes(32).toString('hex');
  const passwordResetToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');
  
  const passwordResetExpires = Date.now() + 10 * 60 * 1000;

  return { resetToken, passwordResetToken, passwordResetExpires };
};

export const verifyPasswordResetToken = (token) => {
  return crypto
    .createHash('sha256')
    .update(token)
    .digest('hex');
};

export const generateOtp = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

export const hashOtp = (otp) => {
  return crypto.createHash('sha256').update(otp).digest('hex');
};