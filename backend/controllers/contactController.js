import Contact from '../models/Contact.js';
import AppError from '../utils/appError.js';
import { protect } from './authController.js';

export const submitContactForm = async (req, res, next) => {
  try {
    const { name, email, subject, message } = req.body;

    let userId = null;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      try {
        await protect(req, res, () => {});
        userId = req.user?._id || null;
      } catch (err) {
        // Ignore auth errors
      }
    }

    const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'];

    const contactSubmission = await Contact.create({
      user: userId,
      name,
      email,
      subject: subject || 'Support',
      message,
      ipAddress,
      userAgent
    });

    res.status(201).json({
      status: 'success',
      message: 'Thank you for contacting us! We will get back to you soon.',
      data: {
        contact: contactSubmission
      }
    });
  } catch (err) {
    next(err);
  }
};

export const getContactSubmissions = async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') {
      return next(new AppError('You are not authorized to view this data', 403));
    }

    const page = req.query.page * 1 || 1;
    const limit = req.query.limit * 1 || 20;
    const skip = (page - 1) * limit;

    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.subject) filter.subject = req.query.subject;
    if (req.query.email) filter.email = req.query.email;

    if (req.query.startDate || req.query.endDate) {
      filter.createdAt = {};
      if (req.query.startDate) filter.createdAt.$gte = new Date(req.query.startDate);
      if (req.query.endDate) filter.createdAt.$lte = new Date(req.query.endDate);
    }

    const submissions = await Contact.find(filter)
      .sort('-createdAt')
      .skip(skip)
      .limit(limit)
      .populate('user', 'name email');

    const total = await Contact.countDocuments(filter);

    res.status(200).json({
      status: 'success',
      results: submissions.length,
      total,
      data: {
        submissions
      }
    });
  } catch (err) {
    next(err);
  }
};

export const updateSubmissionStatus = async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') {
      return next(new AppError('You are not authorized to perform this action', 403));
    }

    const submission = await Contact.findByIdAndUpdate(
      req.params.id,
      { status: req.body.status },
      { new: true, runValidators: true }
    );

    if (!submission) {
      return next(new AppError('No contact submission found with that ID', 404));
    }

    res.status(200).json({
      status: 'success',
      data: {
        submission
      }
    });
  } catch (err) {
    next(err);
  }
};

export const getUserSubmissions = async (req, res, next) => {
  try {
    const submissions = await Contact.find({ user: req.user._id })
      .sort('-createdAt')
      .limit(10);

    res.status(200).json({
      status: 'success',
      results: submissions.length,
      data: {
        submissions
      }
    });
  } catch (err) {
    next(err);
  }
};