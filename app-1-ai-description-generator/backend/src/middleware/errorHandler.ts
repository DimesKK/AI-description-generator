import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { logger } from '../config/logger';

export interface AppError extends Error {
  statusCode?: number;
  code?: string;
  details?: any;
  isOperational?: boolean;
}

export class CustomError extends Error implements AppError {
  public statusCode: number;
  public code?: string;
  public details?: any;
  public isOperational: boolean;

  constructor(
    message: string,
    statusCode: number = 500,
    code?: string,
    details?: any
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

// Error types for different scenarios
export class ValidationError extends CustomError {
  constructor(message: string, details?: any) {
    super(message, 400, 'VALIDATION_ERROR', details);
  }
}

export class AuthenticationError extends CustomError {
  constructor(message: string = 'Authentication failed') {
    super(message, 401, 'AUTHENTICATION_ERROR');
  }
}

export class AuthorizationError extends CustomError {
  constructor(message: string = 'Insufficient permissions') {
    super(message, 403, 'AUTHORIZATION_ERROR');
  }
}

export class NotFoundError extends CustomError {
  constructor(message: string = 'Resource not found') {
    super(message, 404, 'NOT_FOUND_ERROR');
  }
}

export class RateLimitError extends CustomError {
  constructor(message: string = 'Rate limit exceeded') {
    super(message, 429, 'RATE_LIMIT_ERROR');
  }
}

export class ExternalServiceError extends CustomError {
  constructor(service: string, message: string, details?: any) {
    super(`${service} service error: ${message}`, 502, 'EXTERNAL_SERVICE_ERROR', details);
  }
}

// Error handler middleware
export const errorHandler = (
  error: AppError | Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  let customError = error as AppError;
  
  // Log the error
  logger.error('Error occurred:', {
    message: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: (req as any).user?.id
  });

  // Prisma errors
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case 'P2002':
        customError = new CustomError(
          'Unique constraint violation',
          409,
          'DUPLICATE_ERROR',
          { field: error.meta?.target }
        );
        break;
      case 'P2025':
        customError = new NotFoundError('Record not found');
        break;
      case 'P2003':
        customError = new ValidationError('Foreign key constraint violation');
        break;
      case 'P2014':
        customError = new ValidationError('Required relation missing');
        break;
      default:
        customError = new CustomError('Database operation failed', 500, 'DATABASE_ERROR');
    }
  }

  // Prisma validation errors
  if (error instanceof Prisma.PrismaClientValidationError) {
    customError = new ValidationError('Invalid data provided');
  }

  // JWT errors
  if (error.name === 'JsonWebTokenError') {
    customError = new AuthenticationError('Invalid token');
  }

  if (error.name === 'TokenExpiredError') {
    customError = new AuthenticationError('Token expired');
  }

  // Validation errors
  if (error.name === 'ValidationError') {
    customError = new ValidationError(error.message);
  }

  // Cast errors
  if (error.name === 'CastError') {
    customError = new ValidationError('Invalid ID format');
  }

  // Syntax errors (malformed JSON)
  if (error instanceof SyntaxError && 'body' in error) {
    customError = new ValidationError('Invalid JSON format');
  }

  // Default error response
  const statusCode = customError.statusCode || 500;
  const code = customError.code || 'INTERNAL_ERROR';
  const message = customError.message || 'Something went wrong';

  // Prepare error response
  const errorResponse: any = {
    error: message,
    code,
    timestamp: new Date().toISOString(),
    path: req.path,
    method: req.method
  };

  // Add request ID for debugging
  if (req.headers['x-request-id']) {
    errorResponse.requestId = req.headers['x-request-id'];
  }

  // Add details if available
  if (customError.details) {
    errorResponse.details = customError.details;
  }

  // Add stack trace in development
  if (process.env.NODE_ENV === 'development') {
    errorResponse.stack = error.stack;
  }

  // Add suggestions for common errors
  if (statusCode === 429) {
    errorResponse.suggestion = 'Please try again after some time';
  }

  if (statusCode === 403) {
    errorResponse.suggestion = 'Check your permissions or upgrade your plan';
  }

  if (statusCode === 404) {
    errorResponse.suggestion = 'Verify the resource exists and the URL is correct';
  }

  res.status(statusCode).json(errorResponse);
};

// 404 handler for undefined routes
export const notFoundHandler = (req: Request, res: Response, next: NextFunction): void => {
  const error = new NotFoundError(`Route ${req.method} ${req.originalUrl} not found`);
  next(error);
};

// Async error wrapper to catch async errors
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Development error handler with more details
export const developmentErrorHandler = (
  error: AppError | Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const customError = error as AppError;
  
  res.status(customError.statusCode || 500).json({
    error: customError.message,
    code: customError.code || 'INTERNAL_ERROR',
    stack: error.stack,
    details: customError.details,
    url: req.url,
    method: req.method,
    body: req.body,
    params: req.params,
    query: req.query,
    timestamp: new Date().toISOString()
  });
};
