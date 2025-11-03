import dotenv from 'dotenv';
import { logger } from './logger';

// Load environment variables
dotenv.config();

export const config = {
  // Server Configuration
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  apiUrl: process.env.API_URL || 'http://localhost:3001',

  // Database Configuration
  databaseUrl: process.env.DATABASE_URL!,
  
  // Redis Configuration
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',

  // Authentication
  jwtSecret: process.env.JWT_SECRET || 'your-super-secret-jwt-key',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  refreshTokenSecret: process.env.REFRESH_TOKEN_SECRET || 'your-refresh-token-secret',
  refreshTokenExpiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '30d',

  // Shopify Configuration
  shopify: {
    apiKey: process.env.SHOPIFY_API_KEY || '',
    apiSecret: process.env.SHOPIFY_API_SECRET || '',
    scopes: (process.env.SHOPIFY_SCOPES || 'read_products,write_products').split(','),
    apiVersion: process.env.SHOPIFY_API_VERSION || '2023-10',
    webhookSecret: process.env.SHOPIFY_WEBHOOK_SECRET || '',
  },

  // OpenAI Configuration
  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
    model: process.env.OPENAI_MODEL || 'gpt-4',
    maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS || '1000', 10),
    temperature: parseFloat(process.env.OPENAI_TEMPERATURE || '0.7'),
    timeout: parseInt(process.env.OPENAI_TIMEOUT || '30000', 10),
  },

  // Stripe Configuration
  stripe: {
    publicKey: process.env.STRIPE_PUBLIC_KEY || '',
    secretKey: process.env.STRIPE_SECRET_KEY || '',
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
    currency: process.env.STRIPE_CURRENCY || 'usd',
  },

  // Email Configuration
  email: {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || 'noreply@ai-descriptions.com',
  },

  // File Upload Configuration
  upload: {
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760', 10), // 10MB
    allowedMimeTypes: (process.env.ALLOWED_MIME_TYPES || 'image/jpeg,image/png,text/csv').split(','),
    uploadDir: process.env.UPLOAD_DIR || 'uploads',
  },

  // Rate Limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '1000', 10),
    skipSuccessfulRequests: process.env.RATE_LIMIT_SKIP_SUCCESSFUL_REQUESTS === 'true',
  },

  // Feature Flags
  features: {
    bulkGeneration: process.env.FEATURE_BULK_GENERATION !== 'false',
    customTraining: process.env.FEATURE_CUSTOM_TRAINING === 'true',
    multiLanguage: process.env.FEATURE_MULTI_LANGUAGE === 'true',
    seoOptimization: process.env.FEATURE_SEO_OPTIMIZATION !== 'false',
    analytics: process.env.FEATURE_ANALYTICS !== 'false',
    apiAccess: process.env.FEATURE_API_ACCESS === 'true',
  },

  // Pricing Plans
  plans: {
    basic: {
      name: 'Basic',
      price: 29,
      currency: 'usd',
      interval: 'month',
      features: {
        products: 500,
        descriptions: 1000,
        languages: 1,
        support: 'email',
        customTone: false,
        seoOptimization: true,
        bulkGeneration: false,
      },
    },
    pro: {
      name: 'Pro',
      price: 79,
      currency: 'usd',
      interval: 'month',
      features: {
        products: 2000,
        descriptions: 5000,
        languages: 5,
        support: 'priority',
        customTone: true,
        seoOptimization: true,
        bulkGeneration: true,
      },
    },
    enterprise: {
      name: 'Enterprise',
      price: 199,
      currency: 'usd',
      interval: 'month',
      features: {
        products: -1, // unlimited
        descriptions: -1, // unlimited
        languages: 10,
        support: 'dedicated',
        customTone: true,
        seoOptimization: true,
        bulkGeneration: true,
        customTraining: true,
        apiAccess: true,
      },
    },
  },

  // Analytics
  analytics: {
    retentionDays: parseInt(process.env.ANALYTICS_RETENTION_DAYS || '365', 10),
    batchSize: parseInt(process.env.ANALYTICS_BATCH_SIZE || '100', 10),
    refreshInterval: parseInt(process.env.ANALYTICS_REFRESH_INTERVAL || '3600000', 10), // 1 hour
  },

  // Security
  security: {
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '12', 10),
    sessionTimeout: parseInt(process.env.SESSION_TIMEOUT || '86400000', 10), // 24 hours
    passwordMinLength: parseInt(process.env.PASSWORD_MIN_LENGTH || '8', 10),
    maxLoginAttempts: parseInt(process.env.MAX_LOGIN_ATTEMPTS || '5', 10),
    lockoutDuration: parseInt(process.env.LOCKOUT_DURATION || '900000', 10), // 15 minutes
  },

  // Monitoring
  monitoring: {
    healthCheckInterval: parseInt(process.env.HEALTH_CHECK_INTERVAL || '30000', 10), // 30 seconds
    alertThresholds: {
      errorRate: parseFloat(process.env.ERROR_RATE_THRESHOLD || '0.05'), // 5%
      responseTime: parseInt(process.env.RESPONSE_TIME_THRESHOLD || '5000', 10), // 5 seconds
      cpuUsage: parseFloat(process.env.CPU_USAGE_THRESHOLD || '0.8'), // 80%
      memoryUsage: parseFloat(process.env.MEMORY_USAGE_THRESHOLD || '0.8'), // 80%
    },
  },

  // Logging
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    enableConsole: process.env.LOG_ENABLE_CONSOLE !== 'false',
    enableFile: process.env.LOG_ENABLE_FILE !== 'false',
    logDir: process.env.LOG_DIR || 'logs',
  },

  // Cache
  cache: {
    defaultTTL: parseInt(process.env.CACHE_DEFAULT_TTL || '3600', 10), // 1 hour
    maxSize: parseInt(process.env.CACHE_MAX_SIZE || '1000', 10),
  },

  // Job Processing
  jobs: {
    concurrency: parseInt(process.env.JOB_CONCURRENCY || '5', 10),
    timeout: parseInt(process.env.JOB_TIMEOUT || '300000', 10), // 5 minutes
    retryAttempts: parseInt(process.env.JOB_RETRY_ATTEMPTS || '3', 10),
    retryDelay: parseInt(process.env.JOB_RETRY_DELAY || '5000', 10), // 5 seconds
  },
};

// Validation
export const validateConfig = () => {
  const required = [
    'JWT_SECRET',
    'DATABASE_URL',
    'OPENAI_API_KEY',
    'STRIPE_SECRET_KEY',
  ];

  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  // Validate plan configurations
  Object.entries(config.plans).forEach(([planName, plan]) => {
    if (plan.price <= 0) {
      throw new Error(`Invalid price for plan ${planName}`);
    }
  });

  logger.info('✅ Configuration validation passed');
};

export default config;
