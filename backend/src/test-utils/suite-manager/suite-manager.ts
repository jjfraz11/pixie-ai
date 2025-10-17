/**
 * Unified Test Suite Manager
 *
 * Provides a high-level API for managing test suite lifecycle with automatic
 * server management, service discovery, performance monitoring, and cleanup coordination.
 *
 * Key Features:
 * - Automatic server lifecycle management with port allocation
 * - Service discovery and initialization based on service names
 * - Built-in error handling with comprehensive context
 * - Performance monitoring integration
 * - Configurable timeouts and cleanup operations
 * - Backward compatibility with existing test patterns
 */

import { Server } from 'http';
import { SessionType } from '@prisma/client';
import { TestContext } from '../core/context';
import { CleanupManager } from '../core/cleanup-manager';
import { ServerManager } from '../core/server-manager';
import { CacheManager } from '../memoization/cache-manager';
import { PerformanceMonitor } from '../memoization/performance-monitor';
import { UserFactory } from '../factories/user-factory';
import { SessionFactory } from '../factories/session-factory';
import { ParticipantFactory } from '../factories/participant-factory';
import { disconnectPrisma } from '../../prisma';

// ============================================================================
// TypeScript Interfaces and Types
// ============================================================================

/**
 * Service configuration for suite initialization
 */
export interface ServiceConfig {
  name: string;
  service?: any;
  required?: boolean;
  timeout?: number;
  retries?: number;
  dependencies?: string[];
}

/**
 * Suite configuration options
 */
export interface SuiteConfig {
  services?: ServiceConfig[];
  server?: {
    autoStart?: boolean;
    port?: number;
    appFactory?: () => any;
    timeout?: number;
  };
  cleanup?: {
    enabled?: boolean;
    timeout?: number;
    order?: string[];
  };
  performance?: {
    enabled?: boolean;
    logInterval?: number;
    thresholds?: {
      minHitRate?: number;
      maxSetupTime?: number;
    };
  };
  isolation?: {
    enabled?: boolean;
    key?: string;
  };
}

/**
 * Suite execution context
 */
export interface SuiteContext {
  id: string;
  config: SuiteConfig;
  context: TestContext;
  serverManager: ServerManager;
  cleanupManager: CleanupManager;
  cacheManager: CacheManager;
  performanceMonitor?: PerformanceMonitor;
  services: Map<string, any>;
  server?: Server;
  port?: number;
  startTime: number;
  isRunning: boolean;
}

/**
 * Suite execution result
 */
export interface SuiteResult {
  success: boolean;
  duration: number;
  error?: Error;
  context?: SuiteContext;
  metrics?: {
    serverStartTime?: number;
    cleanupTime?: number;
    performanceReport?: any;
  };
}

/**
 * Service discovery function type
 */
export type ServiceDiscoveryFn = (serviceName: string) => Promise<any> | any;

// ============================================================================
// Suite Manager Implementation
// ============================================================================

/**
 * Unified test suite manager with comprehensive lifecycle management
 */
export class SuiteManager {
  private contexts = new Map<string, SuiteContext>();
  private globalServerManager = new ServerManager();
  private globalCacheManager = new CacheManager();
  private serviceDiscovery?: ServiceDiscoveryFn;

  /**
   * Set custom service discovery function
   */
  setServiceDiscovery(discoveryFn: ServiceDiscoveryFn): void {
    this.serviceDiscovery = discoveryFn;
  }

  /**
   * Setup test suite with comprehensive initialization
   */
  async setupTestSuite(config: SuiteConfig = {}, suiteId?: string): Promise<SuiteContext> {
    const contextId = suiteId || `suite-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();

    try {
      // Create suite context
      const context: TestContext = new TestContext();
      const cleanupManager = new CleanupManager(context);
      const serverManager = new ServerManager();

      if (config.isolation?.enabled !== false) {
        const isolationKey = config.isolation?.key || `suite-${contextId}`;
        context.setTestIsolation(isolationKey);
      }

      // Initialize services
      const services = new Map<string, any>();
      if (config.services) {
        await this.initializeServices(config.services, services, context);
      }

      // Start server if configured
      let server: Server | undefined;
      let port: number | undefined;

      if (config.server?.autoStart !== false) {
        const serverConfig = config.server || {};
        port = serverConfig.port || (await serverManager.startServer(serverConfig.appFactory));

        if (serverManager.getServer()) {
          server = serverManager.getServer()!;
        }
      }

      // Setup performance monitoring
      let performanceMonitor: PerformanceMonitor | undefined;
      if (config.performance?.enabled !== false) {
        performanceMonitor = new PerformanceMonitor(this.globalCacheManager);
      }

      const suiteContext: SuiteContext = {
        id: contextId,
        config,
        context,
        serverManager,
        cleanupManager,
        cacheManager: this.globalCacheManager,
        performanceMonitor,
        services,
        server,
        port,
        startTime,
        isRunning: true,
      };

      this.contexts.set(contextId, suiteContext);

      // Log performance metrics if enabled
      if (performanceMonitor && config.performance?.logInterval) {
        this.startPerformanceLogging(suiteContext, config.performance.logInterval);
      }

      return suiteContext;
    } catch (error) {
      console.error(`Failed to setup test suite ${contextId}:`, error);
      throw new Error(`Suite setup failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Teardown test suite with comprehensive cleanup
   */
  async teardownTestSuite(suiteId: string): Promise<SuiteResult> {
    const context = this.contexts.get(suiteId);
    if (!context) {
      throw new Error(`Suite context not found: ${suiteId}`);
    }

    const startTime = Date.now();
    let cleanupTime: number | undefined;
    let error: Error | undefined;

    try {
      // Stop server
      if (context.serverManager) {
        await context.serverManager.stopServer();
      }

      // Perform cleanup if enabled
      if (context.config.cleanup?.enabled !== false) {
        const cleanupStart = Date.now();
        await this.performCleanup(context);
        cleanupTime = Date.now() - cleanupStart;
      }

      // Disconnect from database
      try {
        await disconnectPrisma();
      } catch (dbError) {
        console.warn('Database disconnect warning:', dbError);
      }

      // Clear context tracking
      context.context.clearAllTracked();

      // Stop performance monitoring
      if (context.performanceMonitor && context.config.performance?.logInterval) {
        this.stopPerformanceLogging(suiteId);
      }

      context.isRunning = false;
      this.contexts.delete(suiteId);

      return {
        success: true,
        duration: Date.now() - startTime,
        context,
        metrics: {
          serverStartTime: context.server ? Date.now() - context.startTime : undefined,
          cleanupTime,
          performanceReport: context.performanceMonitor?.getEfficiencyMetrics(),
        },
      };
    } catch (err) {
      error = err instanceof Error ? err : new Error(String(err));

      return {
        success: false,
        duration: Date.now() - startTime,
        error,
        context,
        metrics: { cleanupTime },
      };
    }
  }

  /**
   * Get suite context by ID
   */
  getSuiteContext(suiteId: string): SuiteContext | undefined {
    return this.contexts.get(suiteId);
  }

  /**
   * Check if suite is running
   */
  isSuiteRunning(suiteId: string): boolean {
    const context = this.contexts.get(suiteId);
    return context?.isRunning || false;
  }

  /**
   * Initialize services based on configuration
   */
  private async initializeServices(
    serviceConfigs: ServiceConfig[],
    services: Map<string, any>,
    context: TestContext,
  ): Promise<void> {
    for (const serviceConfig of serviceConfigs) {
      const { name, required = true, timeout = 5000, retries = 2 } = serviceConfig;

      try {
        let service: any;

        if (serviceConfig.service) {
          // Use provided service instance
          service = serviceConfig.service;
        } else if (this.serviceDiscovery) {
          // Use custom discovery function
          service = await this.serviceDiscovery(name);
        } else {
          // Default discovery logic
          service = await this.discoverService(name, context);
        }

        if (!service && required) {
          throw new Error(`Required service '${name}' not found`);
        }

        services.set(name, service);
      } catch (error) {
        if (required) {
          throw new Error(
            `Failed to initialize service '${name}': ${error instanceof Error ? error.message : String(error)}`,
          );
        } else {
          console.warn(`Optional service '${name}' initialization failed:`, error);
        }
      }
    }
  }

  /**
   * Default service discovery logic
   */
  private async discoverService(serviceName: string, context: TestContext): Promise<any> {
    // This could be extended to support more service types
    switch (serviceName.toLowerCase()) {
      case 'user-factory':
        return new UserFactory(context, this.globalCacheManager);
      case 'session-factory':
        return new SessionFactory(context, this.globalCacheManager);
      case 'participant-factory':
        return new ParticipantFactory(context, this.globalCacheManager);
      default:
        return null;
    }
  }

  /**
   * Perform comprehensive cleanup
   */
  private async performCleanup(context: SuiteContext): Promise<void> {
    const { cleanupManager, services, config } = context;
    const timeout = config.cleanup?.timeout || 10000;
    const cleanupOrder = config.cleanup?.order || ['participants', 'sessions', 'users'];

    const cleanupPromise = cleanupManager.cleanupAll(Object.fromEntries(services));

    // Apply timeout to cleanup operations
    await new Promise<void>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Cleanup timed out after ${timeout}ms`));
      }, timeout);

      cleanupPromise
        .then(() => {
          clearTimeout(timeoutId);
          resolve();
        })
        .catch(reject);
    });
  }

  /**
   * Start periodic performance logging
   */
  private startPerformanceLogging(context: SuiteContext, intervalMs: number): void {
    const intervalId = setInterval(() => {
      if (context.performanceMonitor && context.isRunning) {
        console.log(`Suite ${context.id} performance:`, context.performanceMonitor.getPerformanceSummary());
      }
    }, intervalMs);

    // Store interval ID for cleanup
    (context as any)._performanceInterval = intervalId;
  }

  /**
   * Stop periodic performance logging
   */
  private stopPerformanceLogging(suiteId: string): void {
    const context = this.contexts.get(suiteId);
    if (context && (context as any)._performanceInterval) {
      clearInterval((context as any)._performanceInterval);
      delete (context as any)._performanceInterval;
    }
  }
}

/**
 * Global suite manager instance
 */
export const suiteManager = new SuiteManager();

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Setup test suite with default configuration
 */
export async function setupTestSuite(config?: SuiteConfig, suiteId?: string): Promise<SuiteContext> {
  return suiteManager.setupTestSuite(config, suiteId);
}

/**
 * Teardown test suite by ID
 */
export async function teardownTestSuite(suiteId: string): Promise<SuiteResult> {
  return suiteManager.teardownTestSuite(suiteId);
}

/**
 * Setup test suite with common services pre-configured
 */
export async function setupTestSuiteWithServices(
  serviceNames: string[] = ['user-factory', 'session-factory', 'participant-factory'],
  config?: Partial<SuiteConfig>,
  suiteId?: string,
): Promise<SuiteContext> {
  const services: ServiceConfig[] = serviceNames.map((name) => ({ name }));

  const fullConfig: SuiteConfig = {
    services,
    server: { autoStart: true },
    cleanup: { enabled: true },
    performance: { enabled: true },
    ...config,
  };

  return setupTestSuite(fullConfig, suiteId);
}

/**
 * Quick setup for integration tests
 */
export async function setupIntegrationTestSuite(suiteId?: string): Promise<SuiteContext> {
  return setupTestSuiteWithServices(
    ['user-factory', 'session-factory', 'participant-factory'],
    {
      server: { autoStart: true },
      cleanup: { enabled: true, timeout: 15000 },
      performance: { enabled: true, logInterval: 30000 },
    },
    suiteId,
  );
}

/**
 * Quick setup for performance tests
 */
export async function setupPerformanceTestSuite(suiteId?: string): Promise<SuiteContext> {
  return setupTestSuiteWithServices(
    ['user-factory', 'session-factory'],
    {
      server: { autoStart: true },
      cleanup: { enabled: true },
      performance: {
        enabled: true,
        logInterval: 10000,
        thresholds: { minHitRate: 80, maxSetupTime: 5000 },
      },
    },
    suiteId,
  );
}

// ============================================================================
// Enhanced Test Context Integration
// ============================================================================

/**
 * Enhanced Test Context with Suite Management capabilities
 */
export class SuiteEnhancedTestContext extends TestContext {
  private suiteManager = suiteManager;
  private currentSuiteId?: string;

  /**
   * Setup test suite and associate with this context
   */
  async setupSuite(config?: SuiteConfig): Promise<SuiteContext> {
    const suiteContext = await this.suiteManager.setupTestSuite(config, this.currentSuiteId);
    this.currentSuiteId = suiteContext.id;
    return suiteContext;
  }

  /**
   * Teardown current suite
   */
  async teardownSuite(): Promise<SuiteResult> {
    if (!this.currentSuiteId) {
      throw new Error('No active suite to teardown');
    }

    const result = await this.suiteManager.teardownTestSuite(this.currentSuiteId);
    this.currentSuiteId = undefined;
    return result;
  }

  /**
   * Get current suite context
   */
  getCurrentSuite(): SuiteContext | undefined {
    return this.currentSuiteId ? this.suiteManager.getSuiteContext(this.currentSuiteId) : undefined;
  }

  /**
   * Check if suite is currently running
   */
  isSuiteRunning(): boolean {
    return this.currentSuiteId ? this.suiteManager.isSuiteRunning(this.currentSuiteId) : false;
  }
}
