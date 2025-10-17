/**
 * Default memoization configuration values
 */
export const DEFAULT_CACHE_CONFIG = {
  enabled: true,
  maxSize: 1000,
  defaultTTL: 5 * 60 * 1000, // 5 minutes in milliseconds
  enableStats: true,
} as const;

/**
 * Cache size presets for different use cases
 */
export const CACHE_SIZE_PRESETS = {
  SMALL: 100,
  MEDIUM: 500,
  LARGE: 1000,
  EXTRA_LARGE: 5000,
} as const;

/**
 * TTL presets for different use cases
 */
export const TTL_PRESETS = {
  SHORT: 1 * 60 * 1000, // 1 minute
  MEDIUM: 5 * 60 * 1000, // 5 minutes
  LONG: 15 * 60 * 1000, // 15 minutes
  EXTRA_LONG: 60 * 60 * 1000, // 1 hour
} as const;

/**
 * Cache type definitions
 */
export type CacheType = 'users' | 'sessions' | 'participants';

/**
 * Supported cache operations
 */
export type CacheOperation = 'get' | 'set' | 'invalidate' | 'clear';

/**
 * Cache event types for monitoring
 */
export type CacheEventType = 'hit' | 'miss' | 'eviction' | 'expiration';
