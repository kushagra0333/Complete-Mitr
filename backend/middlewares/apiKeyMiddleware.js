import AppError from '../utils/appError.js';

export const apiKeyProtect = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];

  if (!apiKey || apiKey !== process.env.API_KEY) {
    return next(new AppError('Invalid API key', 401));
  }

  next();
};