import Redis from 'ioredis';

class RedisService {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.defaultTTL = 300; // 5 minutes
  }

  async connect() {
    try {
      if (this.client) return this.client;

      const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
      this.client = new Redis(redisUrl, {
        retryDelayOnFailover: 100,
        maxRetriesPerRequest: 3,
        lazyConnect: true
      });

      this.client.on('connect', () => {
        console.log('✅ Redis connected');
        this.isConnected = true;
      });

      this.client.on('error', (error) => {
        console.error('❌ Redis error:', error);
        this.isConnected = false;
      });

      this.client.on('close', () => {
        console.log('🔌 Redis connection closed');
        this.isConnected = false;
      });

      await this.client.connect();
      return this.client;
    } catch (error) {
      console.error('❌ Redis connection failed:', error.message);
      this.isConnected = false;
      return null;
    }
  }

  async get(key) {
    try {
      if (!this.isConnected) return null;
      const value = await this.client.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error('❌ Redis get error:', error);
      return null;
    }
  }

  async set(key, value, ttl = this.defaultTTL) {
    try {
      if (!this.isConnected) return false;
      await this.client.setex(key, ttl, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error('❌ Redis set error:', error);
      return false;
    }
  }

  async del(key) {
    try {
      if (!this.isConnected) return false;
      await this.client.del(key);
      return true;
    } catch (error) {
      console.error('❌ Redis del error:', error);
      return false;
    }
  }

  async clearPattern(pattern) {
    try {
      if (!this.isConnected) return false;
      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(...keys);
      }
      return true;
    } catch (error) {
      console.error('❌ Redis clear pattern error:', error);
      return false;
    }
  }

  async healthCheck() {
    try {
      if (!this.isConnected) return { status: 'disconnected' };
      await this.client.ping();
      return { status: 'connected', client: 'redis' };
    } catch (error) {
      return { status: 'error', error: error.message };
    }
  }
}

export default RedisService;
