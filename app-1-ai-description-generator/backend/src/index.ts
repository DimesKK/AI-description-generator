import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

// Import routes
import authRoutes from './routes/auth';
import productRoutes from './routes/products';
import descriptionRoutes from './routes/descriptions';
import jobRoutes from './routes/jobs';
import analyticsRoutes from './routes/analytics';
import webhookRoutes from './routes/webhooks';
import subscriptionRoutes from './routes/subscriptions';

// Import middleware
import { errorHandler } from './middleware/errorHandler';
import { authenticateToken } from './middleware/auth';

// Import services
import { logger } from './config/logger';
import { redis } from './config/redis';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const prisma = new PrismaClient();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limit each IP to 1000 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Compression middleware
app.use(compression());

// Logging middleware
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('combined', {
    stream: { write: message => logger.info(message.trim()) }
  }));
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0'
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/webhooks', webhookRoutes);

// Protected routes (require authentication)
app.use('/api/products', authenticateToken, productRoutes);
app.use('/api/descriptions', authenticateToken, descriptionRoutes);
app.use('/api/jobs', authenticateToken, jobRoutes);
app.use('/api/analytics', authenticateToken, analyticsRoutes);
app.use('/api/subscriptions', authenticateToken, subscriptionRoutes);

// Catch-all for undefined routes
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    path: req.originalUrl
  });
});

// Error handling middleware
app.use(errorHandler);

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  
  await prisma.$disconnect();
  await redis.disconnect();
  
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  
  await prisma.$disconnect();
  await redis.disconnect();
  
  process.exit(0);
});

// Start server
app.listen(PORT, () => {
  logger.info(`🚀 AI Description Generator API server running on port ${PORT}`);
  logger.info(`📚 API documentation available at http://localhost:${PORT}/docs`);
  logger.info(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Export for testing
export { app, prisma };
