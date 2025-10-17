/**
 * Test utilities for proper cleanup and object tracking
 */

export interface TestObject {
  id: string;
  type: string;
  data?: any;
}

export interface TrackedObjects {
  users: TestObject[];
  sessions: TestObject[];
  participants: TestObject[];
  [key: string]: TestObject[];
}

/**
 * Clean TestContext class focused only on object tracking
 */
export class TestContext {
  private trackedObjects: TrackedObjects = {
    users: [],
    sessions: [],
    participants: [],
  };

  private testIsolationKey?: string;

  /**
   * Track an object for cleanup
   */
  track<T extends TestObject>(type: string, object: T): T {
    if (!this.trackedObjects[type]) {
      this.trackedObjects[type] = [];
    }
    this.trackedObjects[type].push(object);
    return object;
  }

  /**
   * Track multiple objects of the same type
   */
  trackMany<T extends TestObject>(type: string, objects: T[]): T[] {
    objects.forEach((obj) => this.track(type, obj));
    return objects;
  }

  /**
   * Get all tracked objects of a specific type
   */
  getTracked(type: string): TestObject[] {
    return this.trackedObjects[type] || [];
  }

  /**
   * Get all tracked objects
   */
  getAllTracked(): TrackedObjects {
    return { ...this.trackedObjects };
  }

  /**
   * Remove object from tracking (when it's been cleaned up elsewhere)
   */
  untrack(type: string, id: string): void {
    if (this.trackedObjects[type]) {
      this.trackedObjects[type] = this.trackedObjects[type].filter((obj) => obj.id !== id);
    }
  }

  /**
   * Clear all tracked objects of a specific type
   */
  clearTracked(type: string): void {
    if (this.trackedObjects[type]) {
      this.trackedObjects[type] = [];
    }
  }

  /**
   * Clear all tracked objects - useful for test isolation
   */
  clearAllTracked(): void {
    this.trackedObjects = {
      users: [],
      sessions: [],
      participants: [],
    };
  }

  /**
   * Set test isolation key for cache scoping
   */
  setTestIsolation(isolationKey?: string): void {
    this.testIsolationKey = isolationKey;
  }

  /**
   * Get current test isolation key (for testing)
   */
  getTestIsolationKey(): string | undefined {
    return this.testIsolationKey;
  }

  /**
   * Ensure clean test state - clears tracked objects and optionally cleans up existing data
   */
  ensureCleanState(): void {
    this.clearAllTracked();

    // Set test isolation key for this test run
    this.setTestIsolation(`test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
  }

  /**
   * Create isolated test context - useful for tests that need complete isolation
   */
  createIsolatedContext(isolationSuffix?: string): TestContext {
    const isolatedContext = new TestContext();
    const isolationKey = isolationSuffix || `isolated-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    isolatedContext.setTestIsolation(isolationKey);
    // Set isolation key for the current context too
    this.setTestIsolation(`main-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
    return isolatedContext;
  }

  /**
   * Generate cache key for testing purposes (exposes CacheManager functionality)
   */
  generateCacheKey(type: string, properties: Record<string, any>): string {
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

    // Simple hash function for testing (using a basic implementation)
    let hash = 0;
    for (let i = 0; i < keyString.length; i++) {
      const char = keyString.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }

    return Math.abs(hash).toString(16);
  }
}

/**
 * Global test context instance
 */
export const testContext = new TestContext();
