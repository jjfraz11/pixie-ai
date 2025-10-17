/**
 * Suite Manager Usage Examples and Migration Guide
 *
 * This file demonstrates how to use the new unified setup/teardown system
 * and provides migration guidance from existing test patterns.
 *
 * Key Benefits:
 * - Reduced boilerplate code
 * - Automatic server management
 * - Built-in error handling
 * - Performance monitoring
 * - Service discovery and initialization
 */

import { SessionType } from '@prisma/client';
import { TestContext } from '../core/context';
import { CleanupManager } from '../core/cleanup-manager';
import { ServerManager } from '../core/server-manager';
import { UserFactory } from '../factories/user-factory';
import { SessionFactory } from '../factories/session-factory';
import { CacheManager } from '../memoization/cache-manager';
import {
  setupTestSuite,
  teardownTestSuite,
  setupTestSuiteWithServices,
  setupIntegrationTestSuite,
  setupPerformanceTestSuite,
  SuiteManager,
  SuiteEnhancedTestContext,
  SuiteConfig,
  ServiceConfig,
  SuiteContext,
} from './suite-manager';

// Mock implementations for examples
const myCustomService = {};
const userService = {};
const sessionService = {};
const runPerformanceTests = async () => {};
const runIntegrationTests = async () => {};
const runResourceIntensiveTests = async () => {};
const initializeDatabase = async () => ({});
class RedisClient {}
class MessageQueue {}
const appFactory = () => ({});
const cacheManager = new CacheManager();

// ============================================================================
// Basic Usage Examples
// ============================================================================

/**
 * Example 1: Simple test suite setup
 *
 * The most basic usage - just setup and teardown a test suite.
 */
export async function basicSuiteExample() {
  const suiteId = 'my-test-suite';

  try {
    // Setup test suite (automatically starts server and initializes services)
    const context = await setupTestSuite(
      {
        server: { autoStart: true },
        cleanup: { enabled: true },
      },
      suiteId,
    );

    console.log(`Suite started on port ${context.port}`);
    console.log(`Available services:`, Array.from(context.services.keys()));

    // Run your tests here
    // ...
  } finally {
    // Teardown test suite (automatically stops server and cleans up)
    const result = await teardownTestSuite(suiteId);
    console.log(`Suite teardown completed in ${result.duration}ms`);
    console.log(`Cleanup time: ${result.metrics?.cleanupTime}ms`);
  }
}

/**
 * Example 2: Custom service configuration
 *
 * Configure specific services with custom initialization options.
 */
export async function customServicesExample() {
  const services: ServiceConfig[] = [
    {
      name: 'user-factory',
      required: true,
      timeout: 3000,
    },
    {
      name: 'session-factory',
      required: true,
      timeout: 5000,
    },
    {
      name: 'custom-service',
      service: myCustomService, // Use existing service instance
      required: false,
    },
  ];

  const context = await setupTestSuite({
    services,
    server: { autoStart: true, port: 4000 },
    cleanup: { enabled: true, timeout: 10000 },
    performance: { enabled: true },
  });

  // Access initialized services
  const userFactory = context.services.get('user-factory');
  const sessionFactory = context.services.get('session-factory');

  // Use the services...
  const user = await userFactory?.createTestUser(userService, 'test@example.com');
  const session = await sessionFactory?.createTestSession(sessionService, SessionType.BROADCAST, user);

  await teardownTestSuite(context.id);
}

/**
 * Example 3: Performance test suite
 *
 * Setup for performance testing with monitoring and thresholds.
 */
export async function performanceSuiteExample() {
  const context = await setupPerformanceTestSuite();

  // Access performance monitoring
  if (context.performanceMonitor) {
    const efficiency = context.performanceMonitor.getEfficiencyMetrics();
    console.log('Performance metrics:', efficiency);

    // Check if performance is acceptable
    const isAcceptable = context.performanceMonitor.isPerformanceAcceptable(80);
    if (!isAcceptable) {
      console.warn('Performance below acceptable threshold!');
    }
  }

  // Run performance tests...
  await runPerformanceTests();

  await teardownTestSuite(context.id);
}

/**
 * Example 4: Integration test suite
 *
 * Setup for integration testing with longer timeouts and comprehensive cleanup.
 */
export async function integrationSuiteExample() {
  const context = await setupIntegrationTestSuite();

  // Run integration tests that may take longer
  await runIntegrationTests();

  // Cleanup is automatically handled with longer timeout
  const result = await teardownTestSuite(context.id);
  console.log(`Integration tests completed. Cleanup took ${result.metrics?.cleanupTime}ms`);
}

/**
 * Example 5: Enhanced Test Context with Suite Management
 *
 * Using the enhanced context that includes suite management capabilities.
 */
export async function enhancedContextExample() {
  const context = new SuiteEnhancedTestContext();

  try {
    // Setup suite through the enhanced context
    const suiteContext = await context.setupSuite({
      services: [{ name: 'user-factory' }, { name: 'session-factory' }],
      performance: { enabled: true, logInterval: 10000 },
    });

    // Use the context for object tracking as usual
    context.track('users', { id: 'user-1', type: 'users' });

    // Access suite-specific functionality
    console.log('Suite running:', context.isSuiteRunning());
    console.log('Current suite:', context.getCurrentSuite()?.id);
  } finally {
    // Teardown through the enhanced context
    await context.teardownSuite();
  }
}

/**
 * Example 6: Custom Suite Manager with Service Discovery
 *
 * Advanced usage with custom service discovery function.
 */
export async function customDiscoveryExample() {
  const suiteManager = new SuiteManager();

  // Set custom service discovery
  suiteManager.setServiceDiscovery(async (serviceName: string) => {
    switch (serviceName) {
      case 'database':
        return await initializeDatabase();
      case 'cache':
        return new RedisClient();
      case 'messaging':
        return new MessageQueue();
      default:
        return null;
    }
  });

  const context = await suiteManager.setupTestSuite({
    services: [
      { name: 'database', required: true },
      { name: 'cache', required: true },
      { name: 'messaging', required: false },
    ],
  });

  // Use discovered services
  const db = context.services.get('database');
  const cache = context.services.get('cache');

  await suiteManager.teardownTestSuite(context.id);
}

// ============================================================================
// Migration Guide
// ============================================================================

/**
 * Migration Guide: From Old Setup Pattern to New Suite Manager
 *
 * This section shows how to migrate from existing test setup patterns
 * to the new unified suite management system.
 */

// OLD PATTERN (Before Suite Manager)
export async function oldSetupPattern() {
  const context = new TestContext();
  const cleanupManager = new CleanupManager(context);
  const serverManager = new ServerManager();

  // Manual server setup
  const port = await serverManager.startServer(appFactory);
  const server = serverManager.getServer();

  // Manual service initialization
  const userFactory = new UserFactory(context, cacheManager);
  const sessionFactory = new SessionFactory(context, cacheManager);

  // Manual setup...
  return { context, cleanupManager, serverManager, userFactory, sessionFactory };
}

// NEW PATTERN (With Suite Manager)
export async function newSetupPattern() {
  // One-line setup with everything included
  const suiteContext = await setupTestSuiteWithServices(['user-factory', 'session-factory'], {
    server: { autoStart: true },
    cleanup: { enabled: true },
    performance: { enabled: true },
  });

  // Access everything through the context
  const userFactory = suiteContext.services.get('user-factory');
  const sessionFactory = suiteContext.services.get('session-factory');

  return suiteContext;
}

/**
 * Migration Example: Test File Migration
 */

// BEFORE (Old pattern)
export async function oldTestExample() {
  let context: TestContext;
  let cleanupManager: CleanupManager;
  let serverManager: ServerManager;
  const services = {};

  // Manual setup
  context = new TestContext();
  cleanupManager = new CleanupManager(context);
  serverManager = new ServerManager();

  // Manual server and service setup
  await serverManager.startServer();
  // ... manual service initialization

  // Manual teardown
  await cleanupManager.cleanupAll(services);
  await serverManager.stopServer();
  context.clearAllTracked();
}

// AFTER (New pattern)
export async function newTestExample() {
  let suiteContext: SuiteContext;

  // One-line setup
  suiteContext = await setupTestSuiteWithServices(['user-factory', 'session-factory']);

  // Test implementation - much cleaner!
  const userFactory = suiteContext.services.get('user-factory');
  const user = await userFactory?.createTestUser(userService, 'test@example.com');

  if (user) {
    console.log('User created:', user.email);
  }

  // One-line teardown
  await teardownTestSuite(suiteContext.id);
}

// ============================================================================
// Advanced Usage Patterns
// ============================================================================

/**
 * Example: Conditional Service Loading
 *
 * Load services conditionally based on test requirements.
 */
export async function conditionalServicesExample() {
  const requiredServices: string[] = ['user-factory'];
  const optionalServices: string[] = [];

  // Add services based on test type
  if (process.env.TEST_TYPE === 'integration') {
    optionalServices.push('session-factory', 'participant-factory');
  }

  if (process.env.ENABLE_PERFORMANCE_TESTING === 'true') {
    optionalServices.push('performance-monitor');
  }

  const context = await setupTestSuiteWithServices([...requiredServices, ...optionalServices], {
    server: { autoStart: process.env.TEST_TYPE !== 'unit' },
    performance: {
      enabled: process.env.ENABLE_PERFORMANCE_TESTING === 'true',
    },
  });

  return context;
}

/**
 * Example: Custom Error Handling and Recovery
 *
 * Handle setup failures gracefully with custom recovery logic.
 */
export async function errorHandlingExample() {
  const maxRetries = 3;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const context = await setupTestSuite({
        services: [
          { name: 'database', required: true },
          { name: 'external-api', required: false, timeout: 10000 },
        ],
        server: { autoStart: true },
      });

      return context;
    } catch (error) {
      console.error(`Setup attempt ${attempt} failed:`, error);

      if (attempt === maxRetries) {
        throw new Error(`Failed to setup test suite after ${maxRetries} attempts`);
      }

      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
    }
  }
}

/**
 * Example: Resource Monitoring During Tests
 *
 * Monitor resource usage and performance throughout test execution.
 */
export async function monitoringExample() {
  const context = await setupTestSuite({
    performance: {
      enabled: true,
      logInterval: 5000, // Log every 5 seconds
      thresholds: {
        minHitRate: 75,
        maxSetupTime: 3000,
      },
    },
  });

  // Monitor performance during test execution
  const monitor = context.performanceMonitor!;
  console.log('Initial performance:', monitor.getEfficiencyMetrics());

  // Run tests that might affect performance
  await runResourceIntensiveTests();

  console.log('Final performance:', monitor.getEfficiencyMetrics());

  // Check if performance stayed within thresholds
  const finalReport = monitor.getEfficiencyMetrics();
  if (finalReport.hitRate < 75) {
    console.warn('Performance degraded below threshold during tests');
  }

  await teardownTestSuite(context.id);
}

// ============================================================================
// Best Practices
// ============================================================================

/**
 * Recommended Test Structure with Suite Manager
 */
export async function recommendedTestStructure() {
  // 1. Use descriptive suite IDs for better debugging
  const suiteId = `auth-tests-${Date.now()}`;

  // 2. Configure services explicitly
  const config: SuiteConfig = {
    services: [
      { name: 'user-factory', required: true },
      { name: 'session-factory', required: true },
    ],
    server: {
      autoStart: true,
      timeout: 10000,
    },
    cleanup: {
      enabled: true,
      timeout: 15000,
      order: ['participants', 'sessions', 'users'], // Custom cleanup order
    },
    performance: {
      enabled: process.env.NODE_ENV === 'development',
      logInterval: 30000,
    },
    isolation: {
      enabled: true,
      key: `auth-suite-${process.env.JEST_WORKER_ID || 'main'}`,
    },
  };

  // 3. Setup and use
  const context = await setupTestSuite(config, suiteId);

  // 4. Always cleanup in finally block
  return { context, teardown: () => teardownTestSuite(suiteId) };
}

/**
 * Utility for creating test suites with common configurations
 */
export class TestSuiteBuilder {
  private config: SuiteConfig = {};

  withServices(services: string[]): this {
    this.config.services = services.map((name) => ({ name }));
    return this;
  }

  withServer(autoStart: boolean = true, port?: number): this {
    this.config.server = { autoStart, port };
    return this;
  }

  withCleanup(enabled: boolean = true, timeout: number = 10000): this {
    this.config.cleanup = { enabled, timeout };
    return this;
  }

  withPerformance(enabled: boolean = true, logInterval?: number): this {
    this.config.performance = { enabled, logInterval };
    return this;
  }

  withIsolation(enabled: boolean = true, key?: string): this {
    this.config.isolation = { enabled, key };
    return this;
  }

  async build(suiteId?: string): Promise<SuiteContext> {
    return setupTestSuite(this.config, suiteId);
  }

  static create(): TestSuiteBuilder {
    return new TestSuiteBuilder();
  }
}

// Example usage of the builder
export async function builderExample() {
  const context = await TestSuiteBuilder.create()
    .withServices(['user-factory', 'session-factory'])
    .withServer(true, 4000)
    .withCleanup(true, 15000)
    .withPerformance(true, 10000)
    .build('custom-suite');

  await teardownTestSuite(context.id);
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Helper function to run tests with automatic suite management
 */
export async function withTestSuite<T>(config: SuiteConfig, testFn: (context: SuiteContext) => Promise<T>): Promise<T> {
  const context = await setupTestSuite(config);

  try {
    return await testFn(context);
  } finally {
    await teardownTestSuite(context.id);
  }
}

/**
 * Helper function for running multiple test suites in sequence
 */
export async function runTestSuites(
  suites: Array<{ config: SuiteConfig; name: string; testFn: (context: SuiteContext) => Promise<void> }>,
): Promise<void> {
  for (const suite of suites) {
    console.log(`Running test suite: ${suite.name}`);

    await withTestSuite(suite.config, async (context) => {
      await suite.testFn(context);
      console.log(`Completed test suite: ${suite.name}`);
    });
  }
}

// ============================================================================
// Common Configurations
// ============================================================================

/**
 * Pre-configured suite configurations for common scenarios
 */
export const SuiteConfigs = {
  // Minimal configuration for unit tests
  unit: {
    server: { autoStart: false },
    cleanup: { enabled: true },
    performance: { enabled: false },
  },

  // Full configuration for integration tests
  integration: {
    services: [
      { name: 'user-factory' },
      { name: 'session-factory' },
      { name: 'participant-factory' },
    ] as ServiceConfig[],
    server: { autoStart: true },
    cleanup: { enabled: true, timeout: 15000 },
    performance: { enabled: true },
  },

  // Performance testing configuration
  performance: {
    services: [{ name: 'user-factory' }, { name: 'session-factory' }] as ServiceConfig[],
    server: { autoStart: true },
    cleanup: { enabled: true },
    performance: {
      enabled: true,
      logInterval: 5000,
      thresholds: { minHitRate: 80 },
    },
  },

  // Load testing configuration
  load: {
    services: [
      { name: 'user-factory' },
      { name: 'session-factory' },
      { name: 'participant-factory' },
    ] as ServiceConfig[],
    server: { autoStart: true },
    cleanup: { enabled: true, timeout: 30000 },
    performance: {
      enabled: true,
      logInterval: 2000,
    },
  },
};

// Example using pre-configured suites
export async function usingPreConfiguredExample() {
  // Use the integration configuration
  const context = await setupTestSuite(SuiteConfigs.integration);

  // Run tests...
  await runIntegrationTests();

  await teardownTestSuite(context.id);
}
