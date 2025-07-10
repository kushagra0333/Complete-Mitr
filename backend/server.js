import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import mongoSanitize from 'express-mongo-sanitize';
import xss from 'xss-clean';
import hpp from 'hpp';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Routes
import authRouter from './routes/auth.js';
import devicesRouter from './routes/devices.js';
import contactRouter from './routes/contact.js';
import dataRouter from './routes/data.js';

// Middleware
import { globalErrorHandler } from './middlewares/errorMiddleware.js';
import validateEnv from './config/env.js';

// Load environment variables
dotenv.config({ path: './.env' });

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

// Validate required environment variables
validateEnv();

// Suppress Mongoose deprecation warnings
process.removeAllListeners('warning');

// Database connection
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('DB connection successful!'))
.catch(err => {
  console.error('DB connection error:', err);
  process.exit(1);
});

// Global Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

// Security headers
app.use(helmet());

// Body parser
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(cookieParser());

// Data sanitization
app.use(mongoSanitize());
app.use(xss());
app.use(hpp());

// Development logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Rate limiting
const limiter = rateLimit({
  max: 100,
  windowMs: 60 * 60 * 1000,
  message: 'Too many requests from this IP, please try again in an hour!'
});
app.use('/api', limiter);

// Routes
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/devices', devicesRouter);
app.use('/api/v1/contact', contactRouter);
app.use('/api/v1/data', dataRouter);

// Serve static assets in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'client/build')));

  app.get('*', (req, res) => {
    res.sendFile(path.resolve(__dirname, 'client', 'build', 'index.html'));
  });
}

// Error handling
app.use(globalErrorHandler);

const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.log('UNHANDLED REJECTION! Shutting down...');
  console.log(err.name, err.message);
  server.close(() => {
    process.exit(1);
  });
});

// Handle SIGTERM signal
process.on('SIGTERM', () => {
  console.log('SIGTERM RECEIVED. Shutting down gracefully');
  server.close(() => {
    console.log('Process terminated!');
  });
});