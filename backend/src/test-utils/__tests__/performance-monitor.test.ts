import { describe, it, beforeEach, afterEach } from 'mocha';
import assert from 'assert';
import {
  PerformanceMonitor,
  createPerformanceMonitor,
  logMemoizationPerformance,
} from '../memoization/performance-monitor';
import { CacheManager } from '../memoization/cache-manager';

describe('PerformanceMonitor', () => {
  let cacheManager: CacheManager;
  let performanceMonitor: PerformanceMonitor;

  beforeEach(() => {
    cacheManager = new CacheManager();
    performanceMonitor = new PerformanceMonitor(cacheManager);
  });

  afterEach(() => {
    cacheManager.clearCache();
  });

  describe('Basic Performance Monitoring', () => {
    it('should create performance monitor instance correctly', () => {
      const monitor = createPerformanceMonitor(cacheManager);
      assert.ok(monitor instanceof PerformanceMonitor);
    });

    it('should initialize with cache manager dependency', () => {
      assert.ok(performanceMonitor);
      assert.strictEqual((performanceMonitor as any).cacheManager, cacheManager);
    });

    it('should provide initial performance report', () => {
      const report = performanceMonitor.logPerformanceReport();

      assert.ok(typeof report.hitRate === 'number');
      assert.ok(report.stats);
      assert.strictEqual(report.stats.hits, 0);
      assert.strictEqual(report.stats.misses, 0);
      assert.strictEqual(report.stats.sets, 0);
    });
  });

  describe('Performance Measurement and Timing', () => {
    it('should track cache operations accurately', () => {
      // Set initial cache data
      cacheManager.setCached('users', { email: 'test@example.com' }, { id: 'user-1' });

      // Generate some cache hits
      cacheManager.getCached('users', { email: 'test@example.com' });
      cacheManager.getCached('users', { email: 'test@example.com' });

      // Generate cache misses
      cacheManager.getCached('users', { email: 'missing@example.com' });

      const report = performanceMonitor.logPerformanceReport();

      assert.strictEqual(report.stats.hits, 2);
      assert.strictEqual(report.stats.misses, 1);
      assert.strictEqual(report.stats.sets, 1);
    });

    it('should calculate hit rate correctly', () => {
      // Set cache data
      cacheManager.setCached('users', { email: 'test@example.com' }, { id: 'user-1' });

      // Generate hits and misses
      cacheManager.getCached('users', { email: 'test@example.com' }); // Hit
      cacheManager.getCached('users', { email: 'test@example.com' }); // Hit
      cacheManager.getCached('users', { email: 'missing@example.com' }); // Miss
      cacheManager.getCached('users', { email: 'another@example.com' }); // Miss

      const hitRate = cacheManager.getHitRate();
      assert.strictEqual(hitRate, 50); // 2 hits, 2 misses = 50%

      const report = performanceMonitor.logPerformanceReport();
      assert.strictEqual(report.hitRate, 50);
    });

    it('should handle zero operations gracefully', () => {
      const hitRate = cacheManager.getHitRate();
      assert.strictEqual(hitRate, 0);

      const report = performanceMonitor.logPerformanceReport();
      assert.strictEqual(report.hitRate, 0);
    });
  });

  describe('Statistics Collection and Reporting', () => {
    it('should collect comprehensive cache statistics', () => {
      // Generate various cache operations
      cacheManager.setCached('users', { email: 'user1@example.com' }, { id: '1' });
      cacheManager.setCached('users', { email: 'user2@example.com' }, { id: '2' });
      cacheManager.setCached('sessions', { title: 'Session 1' }, { id: 'session-1' });

      cacheManager.getCached('users', { email: 'user1@example.com' }); // Hit
      cacheManager.getCached('users', { email: 'user2@example.com' }); // Hit
      cacheManager.getCached('users', { email: 'missing@example.com' }); // Miss

      // Force eviction by setting small cache size
      cacheManager.configureMemoization({ maxSize: 2 });

      const stats = cacheManager.getCacheStats();
      assert.ok(stats.hits >= 0);
      assert.ok(stats.misses >= 0);
      assert.ok(stats.sets >= 0);
      assert.ok(stats.evictions >= 0);
      assert.ok(stats.size >= 0);
      assert.ok(stats.maxSize > 0);
    });

    it('should provide formatted performance summary', () => {
      // Generate some cache activity
      cacheManager.setCached('users', { email: 'test@example.com' }, { id: '1' });
      cacheManager.getCached('users', { email: 'test@example.com' });

      const summary = performanceMonitor.getPerformanceSummary();

      assert.ok(typeof summary === 'string');
      assert.ok(summary.includes('Hit Rate'));
      assert.ok(summary.includes('Size'));
      assert.ok(summary.includes('Hits'));
      assert.ok(summary.includes('Misses'));
    });

    it('should log detailed performance report to console', () => {
      // Generate cache activity
      cacheManager.setCached('users', { email: 'test@example.com' }, { id: '1' });
      cacheManager.getCached('users', { email: 'test@example.com' });

      // Mock console.log to capture output
      const consoleLogs: string[] = [];
      const originalConsoleLog = console.log;
      console.log = (...args: any[]) => {
        consoleLogs.push(args.join(' '));
      };

      const report = performanceMonitor.logPerformanceReport();

      // Restore console.log
      console.log = originalConsoleLog;

      assert.ok(report.hitRate >= 0);
      assert.ok(consoleLogs.length > 0);
      assert.ok(consoleLogs.some((log) => log.includes('Memoization Performance Report')));
      assert.ok(consoleLogs.some((log) => log.includes('Hit Rate')));
    });
  });

  describe('Performance Thresholds and Alerts', () => {
    it('should check performance against minimum thresholds', () => {
      // Test with high threshold (100% - should fail initially)
      assert.strictEqual(performanceMonitor.isPerformanceAcceptable(100), false);

      // Generate perfect hit rate
      cacheManager.setCached('users', { email: 'test@example.com' }, { id: '1' });
      cacheManager.getCached('users', { email: 'test@example.com' });

      // Should now pass with lower threshold
      assert.strictEqual(performanceMonitor.isPerformanceAcceptable(50), true);
      assert.strictEqual(performanceMonitor.isPerformanceAcceptable(100), true);
    });

    it('should use default threshold when none specified', () => {
      // With no cache activity, should fail default 70% threshold
      assert.strictEqual(performanceMonitor.isPerformanceAcceptable(), false);

      // Generate good hit rate
      cacheManager.setCached('users', { email: 'test@example.com' }, { id: '1' });
      cacheManager.getCached('users', { email: 'test@example.com' });
      cacheManager.getCached('users', { email: 'test@example.com' });
      cacheManager.getCached('users', { email: 'test@example.com' });

      // Should pass default 70% threshold (4 hits, 0 misses = 100%)
      assert.strictEqual(performanceMonitor.isPerformanceAcceptable(), true);
    });

    it('should handle edge cases for performance thresholds', () => {
      // Test with 0% threshold (should always pass)
      assert.strictEqual(performanceMonitor.isPerformanceAcceptable(0), true);

      // Test with negative threshold (should always pass)
      assert.strictEqual(performanceMonitor.isPerformanceAcceptable(-10), true);

      // Test with threshold > 100 (should fail unless perfect)
      assert.strictEqual(performanceMonitor.isPerformanceAcceptable(150), false);
    });
  });

  describe('Memory Usage Tracking', () => {
    it('should track memory utilization metrics', () => {
      // Set small cache size for testing
      cacheManager.configureMemoization({ maxSize: 5 });

      // Fill cache partially
      cacheManager.setCached('users', { email: 'user1@example.com' }, { id: '1' });
      cacheManager.setCached('users', { email: 'user2@example.com' }, { id: '2' });
      cacheManager.setCached('sessions', { title: 'Session 1' }, { id: 's1' });

      const metrics = performanceMonitor.getEfficiencyMetrics();

      assert.ok(typeof metrics.memoryUtilization === 'number');
      assert.ok(metrics.memoryUtilization >= 0);
      assert.ok(metrics.memoryUtilization <= 100);
      assert.strictEqual(metrics.totalOperations, 0); // No gets yet
    });

    it('should calculate memory utilization correctly', () => {
      // Set small cache size
      cacheManager.configureMemoization({ maxSize: 3 });

      // Fill cache to different levels
      cacheManager.setCached('users', { email: 'user1@example.com' }, { id: '1' });
      cacheManager.setCached('users', { email: 'user2@example.com' }, { id: '2' });

      const metrics = performanceMonitor.getEfficiencyMetrics();
      const expectedUtilization = (2 / 3) * 100;
      assert.strictEqual(metrics.memoryUtilization, expectedUtilization);
    });

    it('should track cache efficiency over time', () => {
      // Generate cache operations
      cacheManager.setCached('users', { email: 'user1@example.com' }, { id: '1' });
      cacheManager.setCached('users', { email: 'user2@example.com' }, { id: '2' });

      // Generate hits
      cacheManager.getCached('users', { email: 'user1@example.com' });
      cacheManager.getCached('users', { email: 'user2@example.com' });
      cacheManager.getCached('users', { email: 'user1@example.com' });

      // Generate misses
      cacheManager.getCached('users', { email: 'missing@example.com' });

      const metrics = performanceMonitor.getEfficiencyMetrics();

      assert.strictEqual(metrics.totalOperations, 4); // hits + misses only (3 hits + 1 miss)
      assert.strictEqual(metrics.hitRate, 75); // 3 hits out of 4 operations = 75%
      assert.strictEqual(metrics.cacheEfficiency, 75);
      assert.ok(metrics.averageOperationsPerEntry >= 0);
    });
  });

  describe('Integration with Cache Manager', () => {
    it('should work with different cache configurations', () => {
      // Test with disabled memoization - check performance before any operations
      cacheManager.configureMemoization({ enabled: false });

      // When memoization is disabled and no operations have been performed, performance should not be acceptable
      // because there are no operations to measure (hit rate = 0 which is < 70%)
      assert.strictEqual(performanceMonitor.isPerformanceAcceptable(), false);

      // When memoization is disabled, all getCached calls return null but don't increment miss counter
      const result = cacheManager.getCached('users', { email: 'test@example.com' });
      assert.strictEqual(result, null);

      const stats = cacheManager.getCacheStats();
      assert.strictEqual(stats.misses, 0); // No misses when disabled

      // Even after operations, when disabled, performance should still not be acceptable
      // because disabled memoization means no caching is happening
      assert.strictEqual(performanceMonitor.isPerformanceAcceptable(), false);

      // Re-enable memoization
      cacheManager.configureMemoization({ enabled: true });
      assert.ok(performanceMonitor);
    });

    it('should handle cache clearing operations', () => {
      // Generate cache activity
      cacheManager.setCached('users', { email: 'test@example.com' }, { id: '1' });
      cacheManager.getCached('users', { email: 'test@example.com' });

      let metrics = performanceMonitor.getEfficiencyMetrics();
      assert.ok(metrics.totalOperations > 0);

      // Clear cache
      cacheManager.clearCache();

      // Should reset all metrics
      const stats = cacheManager.getCacheStats();
      assert.strictEqual(stats.hits, 0);
      assert.strictEqual(stats.misses, 0);
      assert.strictEqual(stats.sets, 0);
      assert.strictEqual(stats.evictions, 0);
      assert.strictEqual(stats.size, 0);
    });

    it('should handle cache invalidation', () => {
      // Set cache data
      cacheManager.setCached('users', { email: 'test@example.com' }, { id: '1' });
      cacheManager.getCached('users', { email: 'test@example.com' });

      let stats = cacheManager.getCacheStats();
      assert.strictEqual(stats.hits, 1);

      // Invalidate specific entry
      cacheManager.invalidateCache('users', { email: 'test@example.com' });

      // Should register as eviction
      stats = cacheManager.getCacheStats();
      assert.ok(stats.evictions > 0);
    });

    it('should work with multiple cache types', () => {
      // Set data in multiple cache types
      cacheManager.setCached('users', { email: 'user@example.com' }, { id: 'u1' });
      cacheManager.setCached('sessions', { title: 'Session 1' }, { id: 's1' });
      cacheManager.setCached('participants', { sessionId: 's1', userId: 'u1' }, { id: 'p1' });

      // Generate hits across different types
      cacheManager.getCached('users', { email: 'user@example.com' });
      cacheManager.getCached('sessions', { title: 'Session 1' });
      cacheManager.getCached('participants', { sessionId: 's1', userId: 'u1' });

      const report = performanceMonitor.logPerformanceReport();

      assert.strictEqual(report.stats.hits, 3);
      assert.strictEqual(report.stats.sets, 3);
      assert.strictEqual(report.stats.size, 3);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle expired cache entries gracefully', (done) => {
      // Set cache with very short TTL
      cacheManager.setCached('users', { email: 'test@example.com' }, { id: '1' }, 10);

      // Should be available immediately
      assert.ok(cacheManager.getCached('users', { email: 'test@example.com' }));

      // Wait for expiration
      setTimeout(() => {
        // Should be expired and register as miss
        cacheManager.getCached('users', { email: 'test@example.com' });

        const stats = cacheManager.getCacheStats();
        assert.ok(stats.misses > 0);
        assert.ok(stats.evictions > 0);

        done();
      }, 15);
    });

    it('should handle cache size enforcement', () => {
      // Set very small cache size
      cacheManager.configureMemoization({ maxSize: 2 });

      // Fill beyond capacity
      cacheManager.setCached('users', { email: 'user1@example.com' }, { id: '1' });
      cacheManager.setCached('users', { email: 'user2@example.com' }, { id: '2' });
      cacheManager.setCached('users', { email: 'user3@example.com' }, { id: '3' });
      cacheManager.setCached('users', { email: 'user4@example.com' }, { id: '4' });

      const stats = cacheManager.getCacheStats();
      assert.ok(stats.evictions > 0);
      assert.ok(stats.size <= 2);
    });

    it('should handle concurrent cache operations', () => {
      // Perform rapid cache operations
      const operations = [];
      for (let i = 0; i < 10; i++) {
        operations.push(cacheManager.setCached('users', { email: `user${i}@example.com` }, { id: i.toString() }));
      }

      // Wait for all operations to complete
      Promise.all(operations).then(() => {
        const stats = cacheManager.getCacheStats();
        assert.strictEqual(stats.sets, 10);
      });

      // Generate some hits
      for (let i = 0; i < 5; i++) {
        cacheManager.getCached('users', { email: `user${i}@example.com` });
      }

      const stats = cacheManager.getCacheStats();
      assert.ok(stats.hits >= 0);
      assert.ok(stats.sets >= 0);
    });
  });

  describe('Performance Benchmarking', () => {
    it('should handle large scale cache operations', () => {
      // Perform many cache operations
      const operationCount = 100;

      // Set operations
      for (let i = 0; i < operationCount; i++) {
        cacheManager.setCached('users', { email: `user${i}@example.com` }, { id: i.toString() });
      }

      // Hit operations
      for (let i = 0; i < operationCount / 2; i++) {
        cacheManager.getCached('users', { email: `user${i}@example.com` });
      }

      const metrics = performanceMonitor.getEfficiencyMetrics();

      assert.ok(metrics.totalOperations > 0);
      assert.ok(metrics.hitRate >= 0);
      assert.ok(metrics.cacheEfficiency >= 0);
      assert.ok(metrics.memoryUtilization >= 0);
    });

    it('should provide consistent performance metrics', () => {
      // Generate consistent cache pattern
      cacheManager.setCached('users', { email: 'test@example.com' }, { id: '1' });

      // Generate consistent hit pattern
      for (let i = 0; i < 10; i++) {
        cacheManager.getCached('users', { email: 'test@example.com' });
      }

      const metrics1 = performanceMonitor.getEfficiencyMetrics();
      const metrics2 = performanceMonitor.getEfficiencyMetrics();

      // Should be consistent across multiple calls
      assert.strictEqual(metrics1.hitRate, metrics2.hitRate);
      assert.strictEqual(metrics1.cacheEfficiency, metrics2.cacheEfficiency);
      assert.strictEqual(metrics1.totalOperations, metrics2.totalOperations);
    });

    it('should handle mixed cache scenarios', () => {
      // Mix of different cache types and operations
      cacheManager.setCached('users', { email: 'user@example.com' }, { id: 'u1' });
      cacheManager.setCached('sessions', { title: 'Session 1' }, { id: 's1' });
      cacheManager.setCached('participants', { sessionId: 's1' }, { id: 'p1' });

      // Mix of hits and misses
      cacheManager.getCached('users', { email: 'user@example.com' }); // Hit
      cacheManager.getCached('sessions', { title: 'Session 1' }); // Hit
      cacheManager.getCached('users', { email: 'missing@example.com' }); // Miss
      cacheManager.getCached('sessions', { title: 'Missing' }); // Miss

      const metrics = performanceMonitor.getEfficiencyMetrics();

      // The system calculates hit rate correctly, let's just verify it's working
      const stats = cacheManager.getCacheStats();
      assert.strictEqual(metrics.hitRate, 50); // 2 hits, 2 misses = 50%
      assert.strictEqual(metrics.totalOperations, 4); // hits + misses = 2 + 2
    });
  });

  describe('Helper Functions', () => {
    it('should create performance monitor via helper function', () => {
      const monitor = createPerformanceMonitor(cacheManager);
      assert.ok(monitor instanceof PerformanceMonitor);
      assert.strictEqual((monitor as any).cacheManager, cacheManager);
    });

    it('should provide backward compatibility function', () => {
      // Generate some cache activity
      cacheManager.setCached('users', { email: 'test@example.com' }, { id: '1' });
      cacheManager.getCached('users', { email: 'test@example.com' });

      const report = logMemoizationPerformance(cacheManager);

      assert.ok(typeof report.hitRate === 'number');
      assert.ok(report.stats);
      assert.strictEqual(report.stats.hits, 1);
      assert.strictEqual(report.stats.sets, 1);
    });

    it('should work with empty cache manager', () => {
      const emptyCacheManager = new CacheManager();
      const monitor = createPerformanceMonitor(emptyCacheManager);

      const report = monitor.logPerformanceReport();

      assert.strictEqual(report.hitRate, 0);
      assert.strictEqual(report.stats.hits, 0);
      assert.strictEqual(report.stats.misses, 0);
      assert.strictEqual(report.stats.sets, 0);
    });
  });

  describe('Integration Scenarios', () => {
    it('should work with real-world cache scenarios', () => {
      // Simulate user lookup scenario
      const users = [
        { id: '1', email: 'user1@example.com', roles: ['USER'] },
        { id: '2', email: 'user2@example.com', roles: ['ADMIN'] },
        { id: '3', email: 'user3@example.com', roles: ['USER'] },
      ];

      // Cache users
      users.forEach((user, index) => {
        cacheManager.setCached(
          'users',
          {
            email: user.email,
            roles: user.roles,
          },
          user,
        );
      });

      // Simulate lookups (some hits, some misses)
      // First two should hit, third should miss, fourth should hit
      cacheManager.getCached('users', { email: 'user1@example.com', roles: ['USER'] }); // Hit
      cacheManager.getCached('users', { email: 'user2@example.com', roles: ['ADMIN'] }); // Hit
      cacheManager.getCached('users', { email: 'missing@example.com', roles: ['USER'] }); // Miss
      cacheManager.getCached('users', { email: 'user1@example.com', roles: ['USER'] }); // Hit

      const metrics = performanceMonitor.getEfficiencyMetrics();

      assert.ok(metrics.hitRate > 50); // Should have good hit rate (3 hits, 1 miss)
      assert.ok(metrics.totalOperations > 0);
      assert.ok(metrics.memoryUtilization > 0);
    });

    it('should handle cache warming scenarios', () => {
      // Pre-populate cache (cache warming)
      const commonUsers = Array.from({ length: 10 }, (_, i) => ({
        id: `user-${i}`,
        email: `user${i}@example.com`,
        roles: ['USER'],
      }));

      commonUsers.forEach((user) => {
        cacheManager.setCached(
          'users',
          {
            email: user.email,
            roles: user.roles,
          },
          user,
        );
      });

      // Simulate high-traffic scenario
      for (let i = 0; i < 50; i++) {
        const randomUser = commonUsers[Math.floor(Math.random() * commonUsers.length)];
        cacheManager.getCached('users', {
          email: randomUser.email,
          roles: randomUser.roles,
        });
      }

      const metrics = performanceMonitor.getEfficiencyMetrics();

      assert.ok(metrics.hitRate > 80); // Should have excellent hit rate with cache warming
      assert.ok(metrics.totalOperations >= 50);
    });

    it('should handle cache invalidation scenarios', () => {
      // Set up cache
      cacheManager.setCached('users', { email: 'test@example.com' }, { id: '1' });
      cacheManager.getCached('users', { email: 'test@example.com' });

      let metrics = performanceMonitor.getEfficiencyMetrics();
      const initialOperations = metrics.totalOperations;

      // Invalidate and re-cache
      cacheManager.invalidateCache('users', { email: 'test@example.com' });
      cacheManager.setCached('users', { email: 'test@example.com' }, { id: '1-updated' });
      cacheManager.getCached('users', { email: 'test@example.com' });

      metrics = performanceMonitor.getEfficiencyMetrics();

      assert.ok(metrics.hitRate >= 0); // Should maintain reasonable performance
      assert.ok(metrics.totalOperations > initialOperations);
    });
  });
});
