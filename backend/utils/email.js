import nodemailer from 'nodemailer';
import postmark from 'postmark';
import AppError from './appError.js';

let transporter = null;
let postmarkClient = null;

const isProduction = process.env.NODE_ENV === 'production';
const isTest = process.env.NODE_ENV === 'test';

// Initialize Postmark if available
if (isProduction && process.env.POSTMARK_API_KEY) {
  postmarkClient = new postmark.ServerClient(process.env.POSTMARK_API_KEY);
} else {
  // Fallback to SMTP or MailDev
  transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'localhost',
    port: parseInt(process.env.EMAIL_PORT) || 1025,
    secure: false,
    auth: process.env.EMAIL_USERNAME && process.env.EMAIL_PASSWORD
      ? {
          user: process.env.EMAIL_USERNAME,
          pass: process.env.EMAIL_PASSWORD
        }
      : undefined,
    tls: { rejectUnauthorized: false }
  });
}

// ============================
// Base sendEmail Function
// ============================

export const sendEmail = async (options) => {
  try {
    if (isTest) return;

    // Send using Postmark if configured
    if (postmarkClient) {
      await postmarkClient.sendEmail({
        From: process.env.EMAIL_FROM,
        To: options.email,
        Subject: options.subject,
        HtmlBody: options.html,
        TextBody: options.message
      });
    } else if (transporter) {
      // Send using SMTP
      await transporter.sendMail({
        from: process.env.EMAIL_FROM,
        to: options.email,
        subject: options.subject,
        text: options.message,
        html: options.html
      });
    } else {
      throw new AppError('No email transport configured', 500);
    }
  } catch (err) {
    if (!isProduction) {
      console.warn('[DEV] Email error (ignored):', err.message);
    } else {
      console.error('[PROD] Email error:', err);
      throw new AppError('Failed to send email', 500);
    }
  }
};

// ============================
// Password Reset Email
// ============================

export const sendPasswordReset = async (user, resetURL) => {
  const subject = 'Your password reset token (valid for 10 mins)';
  const message = `Forgot your password? Submit a PATCH request with your new password to: ${resetURL}\nIf you didn't forget your password, ignore this email.`;
  const html = `
    <p>Hi ${user.name || ''},</p>
    <p>Forgot your password? Click the link below to reset it. This link is valid for 10 minutes:</p>
    <a href="${resetURL}">${resetURL}</a>
    <p>If you didn't request a password reset, just ignore this email.</p>
  `;

  await sendEmail({
    email: user.email,
    subject,
    message,
    html
  });
};

// ============================
// OTP Email
// ============================

export const sendOtpEmail = async ({ email, otp }) => {
  const subject = 'Your OTP Code';
  const message = `Your one-time password is: ${otp}. It is valid for 10 minutes.`;
  const html = `
    <p>Your one-time password (OTP) is:</p>
    <h2>${otp}</h2>
    <p>This code is valid for 10 minutes.</p>
    <p>If you didn't try to log in, please secure your account.</p>
  `;

  await sendEmail({
    email,
    subject,
    message,
    html
  });
};
