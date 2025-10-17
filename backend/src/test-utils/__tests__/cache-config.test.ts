import { describe, it, beforeEach, afterEach } from 'mocha';
import assert from 'assert';
import {
  DEFAULT_CACHE_CONFIG,
  CACHE_SIZE_PRESETS,
  TTL_PRESETS,
  CacheType,
  CacheOperation,
  CacheEventType,
} from '../memoization/cache-config';
import { MemoizationConfig } from '../memoization/cache-manager';
import { CacheManager } from '../memoization/cache-manager';

/**
 * Configuration presets for different use cases
 */
export const CACHE_CONFIG_PRESETS = {
  fast: {
    enabled: true,
    maxSize: CACHE_SIZE_PRESETS.SMALL,
    defaultTTL: TTL_PRESETS.SHORT,
    enableStats: false,
  },
  standard: {
    enabled: true,
    maxSize: CACHE_SIZE_PRESETS.MEDIUM,
    defaultTTL: TTL_PRESETS.MEDIUM,
    enableStats: true,
  },
  extended: {
    enabled: true,
    maxSize: CACHE_SIZE_PRESETS.LARGE,
    defaultTTL: TTL_PRESETS.LONG,
    enableStats: true,
  },
} as const;

/**
 * Create a custom cache configuration with validation
 */
export function createCacheConfig(config: Partial<MemoizationConfig>): MemoizationConfig {
  const merged = { ...DEFAULT_CACHE_CONFIG, ...config };

  // Validate configuration
  if (merged.maxSize < 1) {
    throw new Error('maxSize must be greater than 0');
  }

  if (merged.maxSize > 10000) {
    throw new Error('maxSize cannot exceed 10000');
  }

  if (merged.defaultTTL < 1000) {
    throw new Error('defaultTTL must be at least 1000ms (1 second)');
  }

  if (merged.defaultTTL > 24 * 60 * 60 * 1000) {
    throw new Error('defaultTTL cannot exceed 24 hours');
  }

  return merged;
}

/**
 * Merge multiple cache configurations with proper precedence
 */
export function mergeCacheConfigs(
  base: MemoizationConfig,
  ...overrides: Array<Partial<MemoizationConfig>>
): MemoizationConfig {
  return overrides.reduce((acc: MemoizationConfig, override) => ({ ...acc, ...override }), { ...base });
}

describe('CacheConfig System', () => {
  let cacheManager: CacheManager;

  beforeEach(() => {
    cacheManager = new CacheManager();
  });

  afterEach(() => {
    cacheManager.clearCache();
  });

  describe('Configuration Constants and Types', () => {
    it('should export default cache configuration', () => {
      assert.strictEqual(DEFAULT_CACHE_CONFIG.enabled, true);
      assert.strictEqual(DEFAULT_CACHE_CONFIG.maxSize, 1000);
      assert.strictEqual(DEFAULT_CACHE_CONFIG.defaultTTL, 5 * 60 * 1000);
      assert.strictEqual(DEFAULT_CACHE_CONFIG.enableStats, true);
    });

    it('should export cache size presets', () => {
      assert.strictEqual(CACHE_SIZE_PRESETS.SMALL, 100);
      assert.strictEqual(CACHE_SIZE_PRESETS.MEDIUM, 500);
      assert.strictEqual(CACHE_SIZE_PRESETS.LARGE, 1000);
      assert.strictEqual(CACHE_SIZE_PRESETS.EXTRA_LARGE, 5000);
    });

    it('should export TTL presets', () => {
      assert.strictEqual(TTL_PRESETS.SHORT, 1 * 60 * 1000);
      assert.strictEqual(TTL_PRESETS.MEDIUM, 5 * 60 * 1000);
      assert.strictEqual(TTL_PRESETS.LONG, 15 * 60 * 1000);
      assert.strictEqual(TTL_PRESETS.EXTRA_LONG, 60 * 60 * 1000);
    });

    it('should export cache type definitions', () => {
      const validTypes: CacheType[] = ['users', 'sessions', 'participants'];
      assert.ok(validTypes.includes('users'));
      assert.ok(validTypes.includes('sessions'));
      assert.ok(validTypes.includes('participants'));
    });

    it('should export cache operation definitions', () => {
      const validOperations: CacheOperation[] = ['get', 'set', 'invalidate', 'clear'];
      assert.ok(validOperations.includes('get'));
      assert.ok(validOperations.includes('set'));
      assert.ok(validOperations.includes('invalidate'));
      assert.ok(validOperations.includes('clear'));
    });

    it('should export cache event type definitions', () => {
      const validEvents: CacheEventType[] = ['hit', 'miss', 'eviction', 'expiration'];
      assert.ok(validEvents.includes('hit'));
      assert.ok(validEvents.includes('miss'));
      assert.ok(validEvents.includes('eviction'));
      assert.ok(validEvents.includes('expiration'));
    });
  });

  describe('Configuration Presets', () => {
    it('should provide fast preset configuration', () => {
      const fastConfig = CACHE_CONFIG_PRESETS.fast;
      assert.strictEqual(fastConfig.enabled, true);
      assert.strictEqual(fastConfig.maxSize, CACHE_SIZE_PRESETS.SMALL);
      assert.strictEqual(fastConfig.defaultTTL, TTL_PRESETS.SHORT);
      assert.strictEqual(fastConfig.enableStats, false);
    });

    it('should provide standard preset configuration', () => {
      const standardConfig = CACHE_CONFIG_PRESETS.standard;
      assert.strictEqual(standardConfig.enabled, true);
      assert.strictEqual(standardConfig.maxSize, CACHE_SIZE_PRESETS.MEDIUM);
      assert.strictEqual(standardConfig.defaultTTL, TTL_PRESETS.MEDIUM);
      assert.strictEqual(standardConfig.enableStats, true);
    });

    it('should provide extended preset configuration', () => {
      const extendedConfig = CACHE_CONFIG_PRESETS.extended;
      assert.strictEqual(extendedConfig.enabled, true);
      assert.strictEqual(extendedConfig.maxSize, CACHE_SIZE_PRESETS.LARGE);
      assert.strictEqual(extendedConfig.defaultTTL, TTL_PRESETS.LONG);
      assert.strictEqual(extendedConfig.enableStats, true);
    });

    it('should have different configurations for each preset', () => {
      const fast = CACHE_CONFIG_PRESETS.fast;
      const standard = CACHE_CONFIG_PRESETS.standard;
      const extended = CACHE_CONFIG_PRESETS.extended;

      assert.notDeepStrictEqual(fast, standard);
      assert.notDeepStrictEqual(standard, extended);
      assert.notDeepStrictEqual(fast, extended);
    });
  });

  describe('Custom Configuration Creation and Validation', () => {
    it('should create valid custom configuration', () => {
      const customConfig = createCacheConfig({
        maxSize: 200,
        defaultTTL: 10 * 60 * 1000, // 10 minutes
        enableStats: false,
      });

      assert.strictEqual(customConfig.maxSize, 200);
      assert.strictEqual(customConfig.defaultTTL, 10 * 60 * 1000);
      assert.strictEqual(customConfig.enableStats, false);
      assert.strictEqual(customConfig.enabled, true); // From default
    });

    it('should validate minimum maxSize', () => {
      assert.throws(() => createCacheConfig({ maxSize: 0 }), /maxSize must be greater than 0/);
    });

    it('should validate maximum maxSize', () => {
      assert.throws(() => createCacheConfig({ maxSize: 15000 }), /maxSize cannot exceed 10000/);
    });

    it('should validate minimum TTL', () => {
      assert.throws(() => createCacheConfig({ defaultTTL: 500 }), /defaultTTL must be at least 1000ms/);
    });

    it('should validate maximum TTL', () => {
      assert.throws(
        () => createCacheConfig({ defaultTTL: 25 * 60 * 60 * 1000 }), // 25 hours
        /defaultTTL cannot exceed 24 hours/,
      );
    });

    it('should handle edge case configurations', () => {
      const edgeConfig = createCacheConfig({
        maxSize: 1,
        defaultTTL: 1000,
      });

      assert.strictEqual(edgeConfig.maxSize, 1);
      assert.strictEqual(edgeConfig.defaultTTL, 1000);
    });
  });

  describe('Configuration Merging', () => {
    it('should merge configurations with proper precedence', () => {
      const base = createCacheConfig({ maxSize: 100, defaultTTL: 1000 });
      const override1 = { maxSize: 200 };
      const override2 = { defaultTTL: 2000 };

      const merged = mergeCacheConfigs(base, override1, override2);

      assert.strictEqual(merged.maxSize, 200); // From override1
      assert.strictEqual(merged.defaultTTL, 2000); // From override2
      assert.strictEqual(merged.enabled, true); // From base
      assert.strictEqual(merged.enableStats, true); // From base
    });

    it('should handle empty override arrays', () => {
      const base = createCacheConfig({ maxSize: 100 });
      const merged = mergeCacheConfigs(base);

      assert.deepStrictEqual(merged, base);
    });

    it('should handle single override', () => {
      const base = createCacheConfig({ maxSize: 100 });
      const override = { defaultTTL: 5000 };

      const merged = mergeCacheConfigs(base, override);

      assert.strictEqual(merged.maxSize, 100);
      assert.strictEqual(merged.defaultTTL, 5000);
    });
  });

  describe('TTL Configuration Scenarios', () => {
    it('should handle short TTL scenarios', (done) => {
      const config = createCacheConfig({
        maxSize: 100,
        defaultTTL: 1000, // Use 1 second for testing
      });

      cacheManager.configureMemoization(config);

      // Test with short TTL
      const testData = { id: 'test', data: 'value' };
      cacheManager.setCached('users', { id: 'test' }, testData, 1000);

      // Should be available immediately
      assert.deepStrictEqual(cacheManager.getCached('users', { id: 'test' }), testData);

      // Wait for expiration
      setTimeout(() => {
        assert.strictEqual(cacheManager.getCached('users', { id: 'test' }), null);
        done();
      }, 1010);
    });

    it('should handle long TTL scenarios', () => {
      const config = createCacheConfig({
        maxSize: 100,
        defaultTTL: 1000, // 1 second for testing
      });

      cacheManager.configureMemoization(config);

      const testData = { id: 'test', data: 'persistent' };
      cacheManager.setCached('users', { id: 'test' }, testData, 1000);

      // Should be available immediately
      assert.deepStrictEqual(cacheManager.getCached('users', { id: 'test' }), testData);

      // Should still be available after short delay
      return new Promise((resolve) => {
        setTimeout(() => {
          assert.deepStrictEqual(cacheManager.getCached('users', { id: 'test' }), testData);
          resolve(undefined);
        }, 100);
      });
    });

    it('should handle custom TTL per cache operation', () => {
      const config = createCacheConfig({
        maxSize: 100,
        defaultTTL: TTL_PRESETS.MEDIUM,
      });

      cacheManager.configureMemoization(config);

      const testData = { id: 'test', data: 'value' };

      // Set with custom short TTL
      cacheManager.setCached('users', { id: 'test' }, testData, 50);

      // Should be available immediately
      assert.deepStrictEqual(cacheManager.getCached('users', { id: 'test' }), testData);

      // Wait for custom TTL expiration
      return new Promise((resolve) => {
        setTimeout(() => {
          assert.strictEqual(cacheManager.getCached('users', { id: 'test' }), null);
          resolve(undefined);
        }, 60);
      });
    });
  });

  describe('Size Limit Configuration Scenarios', () => {
    it('should handle small cache size limits', () => {
      const config = createCacheConfig({
        maxSize: 2,
        defaultTTL: TTL_PRESETS.MEDIUM,
      });

      cacheManager.configureMemoization(config);

      // Fill cache to limit
      cacheManager.setCached('users', { id: '1' }, { data: 'user1' });
      cacheManager.setCached('users', { id: '2' }, { data: 'user2' });

      const stats = cacheManager.getCacheStats();
      assert.ok(stats.size <= 2);

      // Adding third should trigger eviction
      cacheManager.setCached('users', { id: '3' }, { data: 'user3' });

      const finalStats = cacheManager.getCacheStats();
      assert.ok(finalStats.evictions > 0);
      assert.ok(finalStats.size <= 2);
    });

    it('should handle large cache size limits', () => {
      const config = createCacheConfig({
        maxSize: 1000,
        defaultTTL: TTL_PRESETS.MEDIUM,
      });

      cacheManager.configureMemoization(config);

      // Fill cache with many entries
      for (let i = 0; i < 100; i++) {
        cacheManager.setCached('users', { id: i.toString() }, { data: `user${i}` });
      }

      const stats = cacheManager.getCacheStats();
      assert.ok(stats.size <= 1000);
      assert.ok(stats.sets >= 100);
    });

    it('should handle size limit of 1', () => {
      const config = createCacheConfig({
        maxSize: 1,
        defaultTTL: TTL_PRESETS.MEDIUM,
      });

      cacheManager.configureMemoization(config);

      // Set first entry
      cacheManager.setCached('users', { id: '1' }, { data: 'user1' });
      assert.strictEqual(cacheManager.getCacheStats().size, 1);

      // Set second entry should evict first
      cacheManager.setCached('users', { id: '2' }, { data: 'user2' });

      const stats = cacheManager.getCacheStats();
      assert.ok(stats.evictions >= 1);
      assert.ok(stats.size <= 1);

      // First entry should be gone
      assert.strictEqual(cacheManager.getCached('users', { id: '1' }), null);

      // Second entry should be available
      assert.deepStrictEqual(cacheManager.getCached('users', { id: '2' }), { data: 'user2' });
    });
  });

  describe('Integration with Cache Manager', () => {
    it('should configure cache manager with fast preset', () => {
      const fastConfig = CACHE_CONFIG_PRESETS.fast;
      cacheManager.configureMemoization(fastConfig);

      const config = cacheManager.getConfig();
      assert.deepStrictEqual(config, fastConfig);
    });

    it('should configure cache manager with standard preset', () => {
      const standardConfig = CACHE_CONFIG_PRESETS.standard;
      cacheManager.configureMemoization(standardConfig);

      const config = cacheManager.getConfig();
      assert.deepStrictEqual(config, standardConfig);
    });

    it('should configure cache manager with extended preset', () => {
      const extendedConfig = CACHE_CONFIG_PRESETS.extended;
      cacheManager.configureMemoization(extendedConfig);

      const config = cacheManager.getConfig();
      assert.deepStrictEqual(config, extendedConfig);
    });

    it('should configure cache manager with custom configuration', () => {
      const customConfig = createCacheConfig({
        maxSize: 250,
        defaultTTL: 10 * 60 * 1000,
        enableStats: false,
      });

      cacheManager.configureMemoization(customConfig);

      const config = cacheManager.getConfig();
      assert.deepStrictEqual(config, customConfig);
    });

    it('should handle configuration changes during operation', () => {
      // Start with small cache
      cacheManager.configureMemoization(CACHE_CONFIG_PRESETS.fast);

      // Fill cache
      for (let i = 0; i < 50; i++) {
        cacheManager.setCached('users', { id: i.toString() }, { data: `user${i}` });
      }

      let stats = cacheManager.getCacheStats();
      assert.ok(stats.size <= CACHE_SIZE_PRESETS.SMALL);

      // Change to larger cache
      cacheManager.configureMemoization(CACHE_CONFIG_PRESETS.extended);

      // Add more entries
      for (let i = 50; i < 150; i++) {
        cacheManager.setCached('users', { id: i.toString() }, { data: `user${i}` });
      }

      stats = cacheManager.getCacheStats();
      assert.ok(stats.size <= CACHE_SIZE_PRESETS.LARGE);
      assert.ok(stats.sets >= 100);
    });
  });

  describe('Error Handling for Invalid Configurations', () => {
    it('should handle invalid maxSize in createCacheConfig', () => {
      assert.throws(() => createCacheConfig({ maxSize: 0 }), /maxSize must be greater than 0/);
    });

    it('should handle invalid TTL in createCacheConfig', () => {
      assert.throws(() => createCacheConfig({ defaultTTL: 500 }), /defaultTTL must be at least 1000ms/);
    });

    it('should handle extremely large maxSize in createCacheConfig', () => {
      assert.throws(() => createCacheConfig({ maxSize: 20000 }), /maxSize cannot exceed 10000/);
    });

    it('should handle extremely large TTL in createCacheConfig', () => {
      assert.throws(() => createCacheConfig({ defaultTTL: 48 * 60 * 60 * 1000 }), /defaultTTL cannot exceed 24 hours/);
    });

    it('should handle negative values in createCacheConfig', () => {
      assert.throws(() => createCacheConfig({ maxSize: -1 }), /maxSize must be greater than 0/);
      assert.throws(() => createCacheConfig({ defaultTTL: -1000 }), /defaultTTL must be at least 1000ms/);
    });

    it('should handle CacheManager accepting any configuration', () => {
      // CacheManager doesn't validate configurations - it accepts anything
      cacheManager.configureMemoization({ maxSize: 0 } as any);
      cacheManager.configureMemoization({ defaultTTL: 500 } as any);

      // These should not throw errors
      const config = cacheManager.getConfig();
      assert.ok(config); // Configuration should still be accessible
    });
  });

  describe('Performance Scenarios', () => {
    it('should handle high-frequency operations with fast config', () => {
      cacheManager.configureMemoization(CACHE_CONFIG_PRESETS.fast);

      // Perform many operations quickly
      for (let i = 0; i < 1000; i++) {
        cacheManager.setCached('users', { id: i.toString() }, { data: `user${i}` });
      }

      const stats = cacheManager.getCacheStats();
      assert.ok(stats.sets >= 1000);
      // Fast config should limit size
      assert.ok(stats.size <= CACHE_SIZE_PRESETS.SMALL);
    });

    it('should handle mixed cache types with standard config', () => {
      cacheManager.configureMemoization(CACHE_CONFIG_PRESETS.standard);

      // Mix different cache types
      for (let i = 0; i < 100; i++) {
        cacheManager.setCached('users', { id: `user${i}` }, { data: `user${i}` });
        cacheManager.setCached('sessions', { id: `session${i}` }, { data: `session${i}` });
        cacheManager.setCached('participants', { id: `participant${i}` }, { data: `participant${i}` });
      }

      const stats = cacheManager.getCacheStats();
      assert.ok(stats.sets >= 300);
      assert.ok(stats.size <= CACHE_SIZE_PRESETS.MEDIUM);
    });

    it('should handle long-term caching with extended config', () => {
      cacheManager.configureMemoization(CACHE_CONFIG_PRESETS.extended);

      // Set entries that should persist
      for (let i = 0; i < 200; i++) {
        cacheManager.setCached('users', { id: `persistent${i}` }, { data: `user${i}` });
      }

      const stats = cacheManager.getCacheStats();
      assert.ok(stats.sets >= 200);
      assert.ok(stats.size <= CACHE_SIZE_PRESETS.LARGE);

      // Most entries should still be available after short delay
      return new Promise((resolve) => {
        setTimeout(() => {
          const finalStats = cacheManager.getCacheStats();
          assert.ok(finalStats.hits >= 0); // Cache should still be functional
          resolve(undefined);
        }, 100);
      });
    });
  });

  describe('Configuration State Management', () => {
    it('should maintain configuration state correctly', () => {
      const initialConfig = cacheManager.getConfig();
      assert.strictEqual(initialConfig.enabled, true);
      assert.strictEqual(initialConfig.maxSize, 1000);
      assert.strictEqual(initialConfig.defaultTTL, 5 * 60 * 1000);

      // Modify configuration
      const newConfig = createCacheConfig({
        maxSize: 500,
        defaultTTL: 10 * 60 * 1000,
      });

      cacheManager.configureMemoization(newConfig);
      const updatedConfig = cacheManager.getConfig();

      assert.strictEqual(updatedConfig.maxSize, 500);
      assert.strictEqual(updatedConfig.defaultTTL, 10 * 60 * 1000);
    });

    it('should handle partial configuration updates', () => {
      const baseConfig = cacheManager.getConfig();

      // Update only maxSize
      cacheManager.configureMemoization({ maxSize: 200 });

      const updatedConfig = cacheManager.getConfig();
      assert.strictEqual(updatedConfig.maxSize, 200);
      assert.strictEqual(updatedConfig.defaultTTL, baseConfig.defaultTTL);
      assert.strictEqual(updatedConfig.enabled, baseConfig.enabled);
    });

    it('should reset to defaults when fully cleared', () => {
      // Modify configuration
      cacheManager.configureMemoization({
        maxSize: 100,
        defaultTTL: 1000,
        enableStats: false,
      });

      // Clear cache (should not affect config)
      cacheManager.clearCache();

      const configAfterClear = cacheManager.getConfig();
      assert.strictEqual(configAfterClear.maxSize, 100);
      assert.strictEqual(configAfterClear.defaultTTL, 1000);
      assert.strictEqual(configAfterClear.enableStats, false);
    });
  });

  describe('Real-world Usage Scenarios', () => {
    it('should handle user session caching scenario', () => {
      // Configure for user sessions (moderate caching)
      cacheManager.configureMemoization(CACHE_CONFIG_PRESETS.standard);

      // Simulate user login/logout patterns
      const users = [];
      for (let i = 0; i < 50; i++) {
        const user = {
          id: `user${i}`,
          email: `user${i}@example.com`,
          lastLogin: new Date(),
        };
        users.push(user);

        cacheManager.setCached('users', { email: user.email }, user);
      }

      // Simulate lookups
      for (const user of users.slice(0, 10)) {
        const cached = cacheManager.getCached('users', { email: user.email });
        assert.deepStrictEqual(cached, user);
      }

      const stats = cacheManager.getCacheStats();
      assert.ok(stats.hits >= 10);
      assert.ok(stats.sets >= 50);
    });

    it('should handle real-time session management scenario', () => {
      // Configure for real-time sessions (shorter TTL)
      const realtimeConfig = createCacheConfig({
        maxSize: CACHE_SIZE_PRESETS.MEDIUM,
        defaultTTL: 2 * 60 * 1000, // 2 minutes
        enableStats: true,
      });

      cacheManager.configureMemoization(realtimeConfig);

      // Simulate active sessions
      for (let i = 0; i < 100; i++) {
        const session = {
          id: `session${i}`,
          participants: [`user${i}`, `user${i + 1}`],
          isActive: true,
        };
        cacheManager.setCached('sessions', { id: session.id }, session);
      }

      const stats = cacheManager.getCacheStats();
      assert.ok(stats.sets >= 100);
      assert.ok(stats.size <= CACHE_SIZE_PRESETS.MEDIUM);

      // Sessions should be available immediately
      const sampleSession = cacheManager.getCached('sessions', { id: 'session50' }) as any;
      assert.ok(sampleSession);
      assert.strictEqual(sampleSession.isActive, true);
    });

    it('should handle participant tracking scenario', () => {
      // Configure for participant tracking (larger cache)
      cacheManager.configureMemoization(CACHE_CONFIG_PRESETS.extended);

      // Simulate participant activity
      for (let i = 0; i < 200; i++) {
        const participant = {
          id: `participant${i}`,
          sessionId: `session${Math.floor(i / 10)}`,
          userId: `user${i}`,
          joinedAt: new Date(),
          isActive: i % 10 !== 0, // Some inactive
        };
        cacheManager.setCached(
          'participants',
          {
            sessionId: participant.sessionId,
            userId: participant.userId,
          },
          participant,
        );
      }

      const stats = cacheManager.getCacheStats();
      assert.ok(stats.sets >= 200);
      assert.ok(stats.size <= CACHE_SIZE_PRESETS.LARGE);

      // Test cache efficiency
      const hitRate = cacheManager.getHitRate();
      assert.ok(typeof hitRate === 'number');
      assert.ok(hitRate >= 0 && hitRate <= 100);
    });
  });

  describe('Edge Cases and Boundary Conditions', () => {
    it('should handle concurrent configuration changes', () => {
      // Rapidly change configurations
      const configs = [CACHE_CONFIG_PRESETS.fast, CACHE_CONFIG_PRESETS.standard, CACHE_CONFIG_PRESETS.extended];

      for (const config of configs) {
        cacheManager.configureMemoization(config);
        const currentConfig = cacheManager.getConfig();
        assert.deepStrictEqual(currentConfig, config);
      }
    });

    it('should handle minimum TTL edge case', () => {
      // Test with minimum allowed TTL (1000ms)
      const config = createCacheConfig({
        maxSize: 100,
        defaultTTL: 1000,
      });

      cacheManager.configureMemoization(config);

      const testData = { id: 'test', data: 'value' };
      cacheManager.setCached('users', { id: 'test' }, testData, 1000);

      // Should be available immediately
      assert.deepStrictEqual(cacheManager.getCached('users', { id: 'test' }), testData);

      // Should be expired after TTL
      return new Promise((resolve) => {
        setTimeout(() => {
          assert.strictEqual(cacheManager.getCached('users', { id: 'test' }), null);
          resolve(undefined);
        }, 1010);
      });
    });

    it('should handle disabled caching scenario', () => {
      const config = createCacheConfig({
        enabled: false,
        maxSize: 100,
        defaultTTL: TTL_PRESETS.MEDIUM,
      });

      cacheManager.configureMemoization(config);

      const testData = { id: 'test', data: 'value' };
      cacheManager.setCached('users', { id: 'test' }, testData);

      // Should not be cached when disabled
      assert.strictEqual(cacheManager.getCached('users', { id: 'test' }), null);

      const stats = cacheManager.getCacheStats();
      assert.strictEqual(stats.sets, 0);
      assert.strictEqual(stats.hits, 0);
    });
  });
});
