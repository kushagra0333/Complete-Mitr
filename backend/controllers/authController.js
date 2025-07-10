import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import User from '../models/User.js';
import AppError from '../utils/appError.js';
import { sendEmail, sendPasswordReset, sendOtpEmail } from '../utils/email.js';

const signToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN
  });
};

const createSendToken = (user, statusCode, res) => {
  const token = signToken(user._id);
  
  const cookieOptions = {
    expires: new Date(
      Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000
    ),
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production'
  };

  res.cookie('jwt', token, cookieOptions);

  user.password = undefined;
  user.otpCode = undefined;
  user.otpExpires = undefined;

  res.status(statusCode).json({
    status: 'success',
    token,
    data: {
      user
    }
  });
};

export const signup = async (req, res, next) => {
  try {
    const { name, email, password, passwordConfirm } = req.body;
    
    const newUser = await User.create({
      name,
      email,
      password,
      passwordConfirm
    });

    createSendToken(newUser, 201, res);
  } catch (err) {
    next(err);
  }
};

export const login = async (req, res, next) => {
  try {
    const { email, password, otp } = req.body;

    if (!email || !password) {
      return next(new AppError('Please provide email and password', 400));
    }

    const user = await User.findOne({ email }).select('+password +otpCode +otpExpires');

    if (!user || !(await user.correctPassword(password, user.password))) {
      return next(new AppError('Incorrect email or password', 401));
    }

    if (user.otpEnabled && !otp) {
      const generatedOtp = user.createOtp();
      await user.save({ validateBeforeSave: false });

      await sendOtpEmail({
        email: user.email,
        otp: generatedOtp
      });

      return res.status(200).json({
        status: 'otp_required',
        message: 'OTP sent to your email'
      });
    }

    if (user.otpEnabled && otp) {
      const hashedOtp = crypto.createHash('sha256').update(otp).digest('hex');
      
      if (hashedOtp !== user.otpCode || user.otpExpires < Date.now()) {
        return next(new AppError('Invalid or expired OTP', 401));
      }
    }

    user.otpCode = undefined;
    user.otpExpires = undefined;
    await user.save({ validateBeforeSave: false });

    createSendToken(user, 200, res);
  } catch (err) {
    next(err);
  }
};

export const protect = async (req, res, next) => {
  try {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies.jwt) {
      token = req.cookies.jwt;
    }

    if (!token) {
      return next(new AppError('You are not logged in! Please log in to get access.', 401));
    }

    const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);

    const currentUser = await User.findById(decoded.id);
    if (!currentUser) {
      return next(new AppError('The user belonging to this token no longer exists.', 401));
    }

    if (currentUser.changedPasswordAfter(decoded.iat)) {
      return next(new AppError('User recently changed password! Please log in again.', 401));
    }

    req.user = currentUser;
    next();
  } catch (err) {
    next(err);
  }
};

export const forgotPassword = async (req, res, next) => {
  try {
    const user = await User.findOne({ email: req.body.email });
    if (!user) {
      return next(new AppError('There is no user with that email address.', 404));
    }

    const resetToken = user.createPasswordResetToken();
    await user.save({ validateBeforeSave: false });

    try {
      const resetURL = `${req.protocol}://${req.get('host')}/api/v1/auth/reset-password/${resetToken}`;
      await sendPasswordReset(user, resetURL);

      res.status(200).json({
        status: 'success',
        message: 'Token sent to email!'
      });
    } catch (err) {
      user.passwordResetToken = undefined;
      user.passwordResetExpires = undefined;
      await user.save({ validateBeforeSave: false });

      return next(new AppError('There was an error sending the email. Try again later!', 500));
    }
  } catch (err) {
    next(err);
  }
};

export const resetPassword = async (req, res, next) => {
  try {
    const hashedToken = crypto
      .createHash('sha256')
      .update(req.params.token)
      .digest('hex');

    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() }
    });

    if (!user) {
      return next(new AppError('Token is invalid or has expired', 400));
    }

    user.password = req.body.password;
    user.passwordConfirm = req.body.passwordConfirm;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    createSendToken(user, 200, res);
  } catch (err) {
    next(err);
  }
};

export const updatePassword = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select('+password');

    if (!(await user.correctPassword(req.body.currentPassword, user.password))) {
      return next(new AppError('Your current password is wrong.', 401));
    }

    user.password = req.body.password;
    user.passwordConfirm = req.body.passwordConfirm;
    await user.save();

    createSendToken(user, 200, res);
  } catch (err) {
    next(err);
  }
};

export const toggleOtp = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    user.otpEnabled = !user.otpEnabled;
    await user.save();

    res.status(200).json({
      status: 'success',
      data: {
        otpEnabled: user.otpEnabled
      }
    });
  } catch (err) {
    next(err);
  }
};