import User from '../models/User.js';
import AppError from '../utils/appError.js';

export const getUserProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select('-password');

    if (!user) {
      return next(new AppError('User not found', 404));
    }

    await user.populate('devices');

    res.status(200).json({
      status: 'success',
      data: {
        user,
      },
    });
  } catch (err) {
    next(err);
  }
};

export const updateUserProfile = async (req, res, next) => {
  try {
    const updates = { ...req.body };

    delete updates.password;
    delete updates.passwordConfirm;

    const user = await User.findByIdAndUpdate(req.user._id, updates, {
      new: true,
      runValidators: true,
    }).select('-password');

    res.status(200).json({
      status: 'success',
      data: {
        user,
      },
    });
  } catch (err) {
    next(err);
  }
};