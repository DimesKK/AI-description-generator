import { Request, Response, NextFunction } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { ValidationError } from './errorHandler';

// Generic validation middleware
export const validate = (validations: any[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    await Promise.all(validations.map(validation => validation.run(req)));

    const errors = validationResult(req);
    if (errors.isEmpty()) {
      return next();
    }

    const extractedErrors: any[] = [];
    errors.array().map(err => extractedErrors.push({
      field: err.type === 'field' ? err.path : 'unknown',
      message: err.msg,
      value: err.type === 'field' ? err.value : undefined
    }));

    throw new ValidationError('Validation failed', { errors: extractedErrors });
  };
};

// Product validation rules
export const validateProductCreation = validate([
  body('title')
    .trim()
    .isLength({ min: 1, max: 255 })
    .withMessage('Title must be between 1 and 255 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 5000 })
    .withMessage('Description must be less than 5000 characters'),
  body('vendor')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Vendor must be less than 100 characters'),
  body('productType')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Product type must be less than 100 characters'),
  body('tags')
    .optional()
    .isArray({ max: 50 })
    .withMessage('Tags must be an array with maximum 50 items'),
  body('tags.*')
    .optional()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Each tag must be between 1 and 50 characters'),
  body('images')
    .optional()
    .isArray({ max: 20 })
    .withMessage('Images must be an array with maximum 20 items'),
  body('images.*')
    .optional()
    .isURL()
    .withMessage('Each image must be a valid URL')
]);

export const validateProductUpdate = validate([
  param('id')
    .isString()
    .isLength({ min: 1 })
    .withMessage('Product ID is required'),
  body('title')
    .optional()
    .trim()
    .isLength({ min: 1, max: 255 })
    .withMessage('Title must be between 1 and 255 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 5000 })
    .withMessage('Description must be less than 5000 characters'),
  body('vendor')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Vendor must be less than 100 characters'),
  body('productType')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Product type must be less than 100 characters'),
  body('tags')
    .optional()
    .isArray({ max: 50 })
    .withMessage('Tags must be an array with maximum 50 items'),
  body('tags.*')
    .optional()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Each tag must be between 1 and 50 characters'),
  body('images')
    .optional()
    .isArray({ max: 20 })
    .withMessage('Images must be an array with maximum 20 items'),
  body('images.*')
    .optional()
    .isURL()
    .withMessage('Each image must be a valid URL')
]);

// Description validation rules
export const validateDescriptionCreation = validate([
  body('productId')
    .isString()
    .isLength({ min: 1 })
    .withMessage('Product ID is required'),
  body('content')
    .trim()
    .isLength({ min: 10, max: 10000 })
    .withMessage('Content must be between 10 and 10000 characters'),
  body('keywords')
    .optional()
    .isArray({ max: 20 })
    .withMessage('Keywords must be an array with maximum 20 items'),
  body('keywords.*')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Each keyword must be between 1 and 100 characters'),
  body('tone')
    .optional()
    .isIn(['professional', 'casual', 'friendly', 'formal', 'playful', 'luxury'])
    .withMessage('Tone must be one of: professional, casual, friendly, formal, playful, luxury'),
  body('language')
    .optional()
    .isLength({ min: 2, max: 5 })
    .withMessage('Language code must be 2-5 characters'),
  body('seoOptimization')
    .optional()
    .isBoolean()
    .withMessage('seoOptimization must be a boolean')
]);

export const validateBulkGeneration = validate([
  body('productIds')
    .isArray({ min: 1, max: 1000 })
    .withMessage('Product IDs must be an array with 1-1000 items'),
  body('productIds.*')
    .isString()
    .isLength({ min: 1 })
    .withMessage('Each product ID must be a string'),
  body('config')
    .optional()
    .isObject()
    .withMessage('Config must be an object'),
  body('config.keywords')
    .optional()
    .isArray({ max: 20 })
    .withMessage('Keywords must be an array with maximum 20 items'),
  body('config.keywords.*')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Each keyword must be between 1 and 100 characters'),
  body('config.tone')
    .optional()
    .isIn(['professional', 'casual', 'friendly', 'formal', 'playful', 'luxury'])
    .withMessage('Tone must be one of: professional, casual, friendly, formal, playful, luxury'),
  body('config.language')
    .optional()
    .isLength({ min: 2, max: 5 })
    .withMessage('Language code must be 2-5 characters'),
  body('config.seoOptimization')
    .optional()
    .isBoolean()
    .withMessage('seoOptimization must be a boolean'),
  body('config.wordCount')
    .optional()
    .isInt({ min: 50, max: 1000 })
    .withMessage('Word count must be between 50 and 1000')
]);

// Job validation rules
export const validateJobStatus = validate([
  param('id')
    .isString()
    .isLength({ min: 1 })
    .withMessage('Job ID is required')
]);

// Analytics validation rules
export const validateAnalyticsQuery = validate([
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid ISO 8601 date'),
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid ISO 8601 date'),
  query('granularity')
    .optional()
    .isIn(['hour', 'day', 'week', 'month'])
    .withMessage('Granularity must be one of: hour, day, week, month'),
  query('metric')
    .optional()
    .isIn(['revenue', 'users', 'descriptions', 'apiCalls', 'cost'])
    .withMessage('Metric must be one of: revenue, users, descriptions, apiCalls, cost')
]);

// Pagination validation
export const validatePagination = validate([
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('sortBy')
    .optional()
    .isString()
    .isLength({ min: 1 })
    .withMessage('Sort by must be a string'),
  query('sortOrder')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('Sort order must be asc or desc')
]);

// Search validation
export const validateSearch = validate([
  query('q')
    .optional()
    .trim()
    .isLength({ min: 1, max: 255 })
    .withMessage('Search query must be between 1 and 255 characters')
]);

// Authentication validation
export const validateLogin = validate([
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
]);

export const validateRegistration = validate([
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),
  body('shopifyDomain')
    .optional()
    .trim()
    .isLength({ min: 3, max: 100 })
    .withMessage('Shopify domain must be between 3 and 100 characters')
]);

export const validateShopifyAuth = validate([
  query('shop')
    .isString()
    .isLength({ min: 3 })
    .withMessage('Shop domain is required'),
  query('code')
    .isString()
    .isLength({ min: 1 })
    .withMessage('Authorization code is required'),
  query('hmac')
    .isString()
    .isLength({ min: 1 })
    .withMessage('HMAC signature is required')
]);

// Webhook validation
export const validateWebhook = validate([
  body('type')
    .isString()
    .isLength({ min: 1 })
    .withMessage('Webhook type is required'),
  body('data')
    .isObject()
    .withMessage('Webhook data must be an object')
]);

// Subscription validation
export const validateSubscription = validate([
  body('plan')
    .isIn(['basic', 'pro', 'enterprise'])
    .withMessage('Plan must be one of: basic, pro, enterprise'),
  body('paymentMethodId')
    .optional()
    .isString()
    .isLength({ min: 1 })
    .withMessage('Payment method ID is required when updating payment method')
]);
