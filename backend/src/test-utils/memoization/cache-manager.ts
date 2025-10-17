import crypto from 'crypto';

/**
 * Cache entry interface for memoization
 */
export interface CacheEntry<T> {
  value: T;
  timestamp: number;
  ttl: number;
  hits: number;
  key: string;
}

/**
 * Cache statistics interface
 */
export interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  evictions: number;
  size: number;
  maxSize: number;
}

/**
 * Object cache interface for different entity types
 */
export interface ObjectCache {
  users: Map<string, CacheEntry<any>>;
  sessions: Map<string, CacheEntry<any>>;
  participants: Map<string, CacheEntry<any>>;
}

/**
 * Memoization configuration
 */
export interface MemoizationConfig {
  enabled: boolean;
  maxSize: number;
  defaultTTL: number; // Time to live in milliseconds
  enableStats: boolean;
}

/**
 * Cache manager for memoization functionality
 */
export class CacheManager {
  private cache: ObjectCache = {
    users: new Map(),
    sessions: new Map(),
    participants: new Map(),
  };

  private cacheStats: CacheStats = {
    hits: 0,
    misses: 0,
    sets: 0,
    evictions: 0,
    size: 0,
    maxSize: 1000,
  };

  private config: MemoizationConfig = {
    enabled: true,
    maxSize: 1000,
    defaultTTL: 5 * 60 * 1000, // 5 minutes default TTL
    enableStats: true,
  };

  /**
   * Generate a deterministic cache key from object properties
   */
  private generateCacheKey(type: string, properties: Record<string, any>): string {
    // Create a normalized object with sorted keys for consistent hashing
    const normalized = {
      type,
      ...properties,
      // Normalize array fields for consistent hashing
      ...(properties.roles && { roles: properties.roles.sort() }),
    };

    // Remove undefined and null values
    const clean: Record<string, any> = {};
    Object.keys(normalized).forEach((key) => {
      if (normalized[key] != null) {
        clean[key] = normalized[key];
      }
    });

    // Create deterministic string representation
    const keyString = JSON.stringify(clean, Object.keys(clean).sort());
    return crypto.createHash('md5').update(keyString).digest('hex');
  }

  /**
   * Check if a cache entry is expired
   */
  private isExpired(entry: CacheEntry<any>): boolean {
    return Date.now() - entry.timestamp > entry.ttl;
  }

  /**
   * Evict expired entries from cache
   */
  private evictExpired(type: keyof ObjectCache): void {
    const cache = this.cache[type];
    const expiredKeys: string[] = [];

    for (const [key, entry] of cache.entries()) {
      if (this.isExpired(entry)) {
        expiredKeys.push(key);
      }
    }

    expiredKeys.forEach((key) => {
      cache.delete(key);
      this.cacheStats.evictions++;
    });

    this.cacheStats.size = this.getCacheSize();
  }

  /**
   * Ensure cache doesn't exceed maximum size
   */
  private enforceMaxSize(): void {
    const totalSize = this.getCacheSize();
    if (totalSize <= this.cacheStats.maxSize) {
      return;
    }

    // Evict entries using LRU-like strategy (by hit count and age)
    const allEntries: Array<{ key: string; entry: CacheEntry<any>; type: string }> = [];

    Object.keys(this.cache).forEach((type) => {
      const cache = this.cache[type as keyof ObjectCache];
      for (const [key, entry] of cache.entries()) {
        allEntries.push({ key, entry, type });
      }
    });

    // Sort by hits (ascending) and age (ascending) for eviction
    allEntries.sort((a, b) => {
      if (a.entry.hits !== b.entry.hits) {
        return a.entry.hits - b.entry.hits;
      }
      return a.entry.timestamp - b.entry.timestamp;
    });

    // Evict oldest/lowest hit entries until we're under the limit
    let evicted = 0;
    while (this.getCacheSize() > this.cacheStats.maxSize && allEntries.length > 0) {
      const { key, type } = allEntries.shift()!;
      this.cache[type as keyof ObjectCache].delete(key);
      evicted++;
    }

    this.cacheStats.evictions += evicted;
    this.cacheStats.size = this.getCacheSize();
  }

  /**
   * Get total cache size across all types
   */
  private getCacheSize(): number {
    return Object.values(this.cache).reduce((total, cache) => total + cache.size, 0);
  }

  /**
   * Get cached object if exists and not expired
   */
  getCached<T>(type: string, properties: Record<string, any>): T | null {
    if (!this.config.enabled) {
      return null;
    }

    const cache = this.cache[type as keyof ObjectCache];
    if (!cache) {
      this.cacheStats.misses++;
      return null;
    }

    const key = this.generateCacheKey(type, properties);
    const entry = cache.get(key);

    if (!entry) {
      this.cacheStats.misses++;
      return null;
    }

    if (this.isExpired(entry)) {
      cache.delete(key);
      this.cacheStats.evictions++;
      this.cacheStats.misses++;
      this.cacheStats.size = this.getCacheSize();
      return null;
    }

    // Update hit statistics
    entry.hits++;
    this.cacheStats.hits++;

    return entry.value as T;
  }

  /**
   * Cache an object with optional TTL
   */
  setCached<T>(type: string, properties: Record<string, any>, value: T, ttl?: number): void {
    if (!this.config.enabled) {
      return;
    }

    const cache = this.cache[type as keyof ObjectCache];
    if (!cache) {
      return;
    }

    const key = this.generateCacheKey(type, properties);
    const finalTTL = ttl || this.config.defaultTTL;

    // Evict expired entries first
    this.evictExpired(type as keyof ObjectCache);

    // Create cache entry
    const entry: CacheEntry<T> = {
      value,
      timestamp: Date.now(),
      ttl: finalTTL,
      hits: 0,
      key,
    };

    cache.set(key, entry);
    this.cacheStats.sets++;
    this.enforceMaxSize();
  }

  /**
   * Invalidate cache entries for a specific type and properties
   */
  invalidateCache(type: string, properties?: Record<string, any>): void {
    const cache = this.cache[type as keyof ObjectCache];
    if (!cache) {
      return;
    }

    if (properties) {
      // Invalidate entries that match the provided properties as a subset
      const keysToDelete: string[] = [];
      for (const [key, entry] of cache.entries()) {
        if (this.matchesProperties(entry.key, properties)) {
          keysToDelete.push(key);
        }
      }

      keysToDelete.forEach((key) => {
        cache.delete(key);
        this.cacheStats.evictions++;
      });
    } else {
      // Invalidate all entries of this type
      const sizeBefore = cache.size;
      cache.clear();
      this.cacheStats.evictions += sizeBefore;
    }

    this.cacheStats.size = this.getCacheSize();
  }

  /**
   * Check if a cache key matches the provided properties as a subset
   */
  private matchesProperties(cacheKey: string, properties: Record<string, any>): boolean {
    try {
      // For simplicity, check if all provided properties are in the key
      // This is a basic implementation; for full matching, we'd need to decode the key
      const propKeys = Object.keys(properties).sort();
      const keyString = propKeys.join(',');
      return cacheKey.includes(keyString);
    } catch {
      return false;
    }
  }

  /**
   * Get cache statistics for monitoring
   */
  getCacheStats(): CacheStats {
    return { ...this.cacheStats, size: this.getCacheSize() };
  }

  /**
   * Get hit rate percentage
   */
  getHitRate(): number {
    const total = this.cacheStats.hits + this.cacheStats.misses;
    return total === 0 ? 0 : (this.cacheStats.hits / total) * 100;
  }

  /**
   * Clear all caches and reset statistics
   */
  clearCache(): void {
    Object.values(this.cache).forEach((cache) => cache.clear());
    this.cacheStats = {
      hits: 0,
      misses: 0,
      sets: 0,
      evictions: 0,
      size: 0,
      maxSize: this.cacheStats.maxSize,
    };
  }

  /**
   * Configure memoization settings
   */
  configureMemoization(config: Partial<MemoizationConfig>): void {
    this.config = { ...this.config, ...config };
    this.cacheStats.maxSize = this.config.maxSize;
  }

  /**
   * Get current configuration
   */
  getConfig(): MemoizationConfig {
    return { ...this.config };
  }
}
