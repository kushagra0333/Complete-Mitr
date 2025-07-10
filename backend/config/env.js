import AppError from '../utils/appError.js';

const validateEnv = () => {
  const requiredEnvVars = [
    'MONGODB_URI',
    'JWT_SECRET',
    'JWT_EXPIRES_IN',
    'API_KEY',
    'EMAIL_HOST',
    'EMAIL_PORT',
    'EMAIL_FROM'
  ];

  // Only require email credentials in production
  if (process.env.NODE_ENV === 'production') {
    requiredEnvVars.push('EMAIL_USERNAME', 'EMAIL_PASSWORD');
  }

  requiredEnvVars.forEach((envVar) => {
    if (!process.env[envVar]) {
      throw new AppError(`Missing required environment variable: ${envVar}`, 500);
    }
  });
};
export default validateEnv;