import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { prisma } from '../config/database';
import { logger } from '../config/logger';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    plan: string;
    subscriptionStatus: string;
  };
}

export const authenticateToken = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      res.status(401).json({
        error: 'Access token required',
        code: 'TOKEN_MISSING'
      });
      return;
    }

    // Verify JWT token
    const decoded = jwt.verify(token, config.jwtSecret) as any;
    
    // Check if user exists and get fresh user data
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        plan: true,
        subscriptionStatus: true,
        subscriptionId: true
      }
    });

    if (!user) {
      res.status(401).json({
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
      return;
    }

    // Check if subscription is active (except for certain endpoints)
    const publicEndpoints = ['/api/auth/refresh', '/api/auth/profile'];
    if (!publicEndpoints.includes(req.path) && user.subscriptionStatus !== 'active') {
      res.status(403).json({
        error: 'Subscription required',
        code: 'SUBSCRIPTION_REQUIRED',
        details: 'Please activate your subscription to access this feature'
      });
      return;
    }

    // Attach user to request
    req.user = {
      id: user.id,
      email: user.email,
      plan: user.plan,
      subscriptionStatus: user.subscriptionStatus
    };

    next();
  } catch (error) {
    logger.error('Authentication error:', error);

    if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({
        error: 'Invalid token',
        code: 'TOKEN_INVALID'
      });
      return;
    }

    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({
        error: 'Token expired',
        code: 'TOKEN_EXPIRED'
      });
      return;
    }

    res.status(500).json({
      error: 'Authentication failed',
      code: 'AUTH_ERROR'
    });
  }
};

export const requirePlan = (requiredPlan: string) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
      return;
    }

    const planHierarchy = {
      'basic': 0,
      'pro': 1,
      'enterprise': 2
    };

    const userPlanLevel = planHierarchy[req.user.plan as keyof typeof planHierarchy] || -1;
    const requiredPlanLevel = planHierarchy[requiredPlan as keyof typeof planHierarchy] || -1;

    if (userPlanLevel < requiredPlanLevel) {
      res.status(403).json({
        error: 'Upgrade required',
        code: 'UPGRADE_REQUIRED',
        details: `This feature requires ${requiredPlan} plan or higher`,
        currentPlan: req.user.plan,
        requiredPlan
      });
      return;
    }

    next();
  };
};

export const requireFeature = (feature: string) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
      return;
    }

    // Check feature availability based on user's plan
    const planFeatures = {
      'basic': ['seoOptimization', 'bulkGeneration'],
      'pro': ['seoOptimization', 'bulkGeneration', 'customTone', 'multiLanguage'],
      'enterprise': ['seoOptimization', 'bulkGeneration', 'customTone', 'multiLanguage', 'customTraining', 'apiAccess']
    };

    const userFeatures = planFeatures[req.user.plan as keyof typeof planFeatures] || [];

    if (!userFeatures.includes(feature)) {
      res.status(403).json({
        error: 'Feature not available',
        code: 'FEATURE_NOT_AVAILABLE',
        details: `This feature is not available in your current plan`,
        feature,
        currentPlan: req.user.plan
      });
      return;
    }

    next();
  };
};

export const optionalAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      const decoded = jwt.verify(token, config.jwtSecret) as any;
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: {
          id: true,
          email: true,
          plan: true,
          subscriptionStatus: true
        }
      });

      if (user) {
        req.user = {
          id: user.id,
          email: user.email,
          plan: user.plan,
          subscriptionStatus: user.subscriptionStatus
        };
      }
    }

    next();
  } catch (error) {
    // For optional auth, we don't return errors, just continue without user
    next();
  }
};
