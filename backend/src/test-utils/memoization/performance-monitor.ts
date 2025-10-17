import { CacheManager, CacheStats } from './cache-manager';

/**
 * Performance monitoring helper for memoization effectiveness
 */
export class PerformanceMonitor {
  constructor(private cacheManager: CacheManager) {}

  /**
   * Log memoization performance report
   */
  logPerformanceReport(): { hitRate: number; stats: CacheStats } {
    const stats = this.cacheManager.getCacheStats();
    const hitRate = this.cacheManager.getHitRate();

    console.log('=== Memoization Performance Report ===');
    console.log(`Cache Hit Rate: ${hitRate.toFixed(2)}%`);
    console.log(`Total Hits: ${stats.hits}`);
    console.log(`Total Misses: ${stats.misses}`);
    console.log(`Cache Sets: ${stats.sets}`);
    console.log(`Cache Evictions: ${stats.evictions}`);
    console.log(`Current Cache Size: ${stats.size}/${stats.maxSize}`);
    console.log('=====================================');

    return { hitRate, stats };
  }

  /**
   * Get performance summary as formatted string
   */
  getPerformanceSummary(): string {
    const stats = this.cacheManager.getCacheStats();
    const hitRate = this.cacheManager.getHitRate();

    return `Hit Rate: ${hitRate.toFixed(2)}% | Size: ${stats.size}/${stats.maxSize} | Hits: ${stats.hits} | Misses: ${
      stats.misses
    }`;
  }

  /**
   * Check if cache performance is within acceptable thresholds
   */
  isPerformanceAcceptable(minHitRate: number = 70): boolean {
    const hitRate = this.cacheManager.getHitRate();
    return hitRate >= minHitRate;
  }

  /**
   * Get cache efficiency metrics
   */
  getEfficiencyMetrics() {
    const stats = this.cacheManager.getCacheStats();
    const hitRate = this.cacheManager.getHitRate();

    const totalOperations = stats.hits + stats.misses;
    const cacheEfficiency = totalOperations > 0 ? (stats.hits / totalOperations) * 100 : 0;
    const memoryUtilization = (stats.size / stats.maxSize) * 100;

    return {
      hitRate,
      cacheEfficiency,
      memoryUtilization,
      totalOperations,
      averageOperationsPerEntry: stats.size > 0 ? totalOperations / stats.size : 0,
    };
  }
}

/**
 * Helper function to create performance monitor instance
 */
export function createPerformanceMonitor(cacheManager: CacheManager): PerformanceMonitor {
  return new PerformanceMonitor(cacheManager);
}

/**
 * Standalone performance monitoring function for backward compatibility
 */
export function logMemoizationPerformance(cacheManager: CacheManager): { hitRate: number; stats: CacheStats } {
  const monitor = new PerformanceMonitor(cacheManager);
  return monitor.logPerformanceReport();
}
