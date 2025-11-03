import { createClient, RedisClientType } from 'redis';

let redisClient: RedisClientType;

export const getRedisClient = (): RedisClientType => {
  if (!redisClient) {
    redisClient = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      socket: {
        connectTimeout: 5000,
        lazyConnect: true
      },
      retryDelayOnFailover: 100,
      enableReadyCheck: true,
      maxRetriesPerRequest: 3
    });

    redisClient.on('error', (err) => {
      console.error('Redis Client Error:', err);
    });

    redisClient.on('connect', () => {
      console.log('Redis Client connected');
    });

    redisClient.on('ready', () => {
      console.log('Redis Client ready');
    });

    redisClient.on('end', () => {
      console.log('Redis Client disconnected');
    });

    // Auto-connect on module load
    redisClient.connect().catch((err) => {
      console.error('Failed to connect to Redis:', err);
    });
  }

  return redisClient;
};

export const redis = getRedisClient();

// Cache utilities
export const cache = {
  get: async (key: string): Promise<string | null> => {
    try {
      return await redis.get(key);
    } catch (error) {
      console.error('Redis GET error:', error);
      return null;
    }
  },

  set: async (key: string, value: string, ttlSeconds?: number): Promise<boolean> => {
    try {
      if (ttlSeconds) {
        await redis.setEx(key, ttlSeconds, value);
      } else {
        await redis.set(key, value);
      }
      return true;
    } catch (error) {
      console.error('Redis SET error:', error);
      return false;
    }
  },

  del: async (key: string): Promise<boolean> => {
    try {
      await redis.del(key);
      return true;
    } catch (error) {
      console.error('Redis DEL error:', error);
      return false;
    }
  },

  exists: async (key: string): Promise<boolean> => {
    try {
      const result = await redis.exists(key);
      return result === 1;
    } catch (error) {
      console.error('Redis EXISTS error:', error);
      return false;
    }
  }
};

// Rate limiting utilities
export const rateLimiter = {
  check: async (key: string, limit: number, windowSeconds: number): Promise<boolean> => {
    try {
      const now = Math.floor(Date.now() / 1000);
      const window = Math.floor(now / windowSeconds);
      const redisKey = `${key}:${window}`;
      
      const current = await redis.incr(redisKey);
      
      if (current === 1) {
        await redis.expire(redisKey, windowSeconds);
      }
      
      return current <= limit;
    } catch (error) {
      console.error('Rate limiter error:', error);
      return true; // Allow on error
    }
  },

  reset: async (key: string): Promise<boolean> => {
    try {
      const keys = await redis.keys(`${key}:*`);
      if (keys.length > 0) {
        await redis.del(keys);
      }
      return true;
    } catch (error) {
      console.error('Rate limiter reset error:', error);
      return false;
    }
  }
};

// Queue utilities for job processing
export const queue = {
  add: async (queueName: string, jobData: any, options?: { delay?: number, attempts?: number }): Promise<string | null> => {
    try {
      const jobId = `${queueName}:${Date.now()}:${Math.random().toString(36).substr(2, 9)}`;
      
      const queueData = {
        id: jobId,
        data: jobData,
        timestamp: Date.now(),
        attempts: options?.attempts || 3
      };

      const key = `queue:${queueName}`;
      await redis.lPush(key, JSON.stringify(queueData));
      
      // Set expiration for queue data
      if (options?.delay) {
        await redis.setEx(`${key}:delayed:${jobId}`, Math.floor(options.delay / 1000), JSON.stringify(queueData));
      }
      
      return jobId;
    } catch (error) {
      console.error('Queue add error:', error);
      return null;
    }
  },

  getNext: async (queueName: string): Promise<any | null> => {
    try {
      const key = `queue:${queueName}`;
      const result = await redis.rPop(key);
      return result ? JSON.parse(result) : null;
    } catch (error) {
      console.error('Queue getNext error:', error);
      return null;
    }
  },

  getSize: async (queueName: string): Promise<number> => {
    try {
      const key = `queue:${queueName}`;
      return await redis.lLen(key);
    } catch (error) {
      console.error('Queue getSize error:', error);
      return 0;
    }
  }
};

export default redis;
