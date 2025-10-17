/**
 * TestServiceBuilder - Unified abstraction for test utilities
 *
 * Provides a fluent API that combines suite management, scenario creation,
 * and enhanced API client functionality with automatic service discovery
 * and dependency injection while maintaining backward compatibility.
 */

import { SessionType } from '@prisma/client';
import { TestContext } from '../core/context';
import { CleanupManager } from '../core/cleanup-manager';
import { ServerManager } from '../core/server-manager';
import { CacheManager } from '../memoization/cache-manager';
import { PerformanceMonitor } from '../memoization/performance-monitor';
import { UserFactory } from '../factories/user-factory';
import { SessionFactory } from '../factories/session-factory';
import { ParticipantFactory } from '../factories/participant-factory';
import {
  ScenarioFactory,
  ScenarioConfig,
  AuthScenario,
  BroadcastScenario,
  P2PScenario,
} from '../scenario-factories/scenario-factories';
import { SuiteManager, SuiteConfig, SuiteContext, ServiceConfig } from '../suite-manager/suite-manager';
import { EnhancedApiClient, RetryConfig, RequestMetrics } from '../api/enhanced-api-client';
import { DEFAULT_PASSWORD_STRONG } from '../api/auth-client';

/**
 * Builder configuration options
 */
export interface TestServiceBuilderConfig {
  suite?: SuiteConfig;
  services?: ServiceConfig[];
  api?: {
    baseUrl?: string;
    timeout?: number;
    retryConfig?: RetryConfig;
  };
  performance?: {
    enabled?: boolean;
    logInterval?: number;
  };
  isolation?: {
    enabled?: boolean;
    key?: string;
  };
}

/**
 * Service discovery function type
 */
export type ServiceDiscoveryFunction = (serviceName: string) => Promise<any> | any;

/**
 * Unified test service builder with fluent API
 */
export class TestServiceBuilder {
  private config: TestServiceBuilderConfig;
  private context?: TestContext;
  private suiteManager: SuiteManager;
  private cacheManager: CacheManager;
  private serverManager: ServerManager;
  private cleanupManager?: CleanupManager;
  private apiClient?: EnhancedApiClient;
  private scenarioFactory?: ScenarioFactory;
  private userFactory?: UserFactory;
  private sessionFactory?: SessionFactory;
  private participantFactory?: ParticipantFactory;
  private performanceMonitor?: PerformanceMonitor;
  private serviceDiscovery?: ServiceDiscoveryFunction;
  private services = new Map<string, any>();
  private suiteContext?: SuiteContext;

  constructor(config: TestServiceBuilderConfig = {}) {
    this.config = {
      suite: { server: { autoStart: true }, cleanup: { enabled: true } },
      api: { timeout: 5000 },
      performance: { enabled: false },
      isolation: { enabled: true },
      ...config,
    };

    this.suiteManager = new SuiteManager();
    this.cacheManager = new CacheManager();
    this.serverManager = new ServerManager();
  }

  /**
   * Set custom service discovery function
   */
  withServiceDiscovery(discoveryFn: ServiceDiscoveryFunction): this {
    this.serviceDiscovery = discoveryFn;
    this.suiteManager.setServiceDiscovery(discoveryFn);
    return this;
  }

  /**
   * Configure suite options
   */
  withSuite(config: Partial<SuiteConfig>): this {
    this.config.suite = { ...this.config.suite, ...config };
    return this;
  }

  /**
   * Configure API client options
   */
  withApi(config: { baseUrl?: string; timeout?: number; retryConfig?: RetryConfig }): this {
    this.config.api = { ...this.config.api, ...config };
    return this;
  }

  /**
   * Enable performance monitoring
   */
  withPerformanceMonitoring(logInterval?: number): this {
    this.config.performance = { enabled: true, logInterval };
    return this;
  }

  /**
   * Configure test isolation
   */
  withIsolation(key?: string): this {
    this.config.isolation = { enabled: true, key };
    return this;
  }

  /**
   * Add custom services
   */
  withServices(services: ServiceConfig[]): this {
    this.config.services = services;
    return this;
  }

  /**
   * Initialize all services and dependencies
   */
  async build(): Promise<TestServiceBuilder> {
    // Initialize test context
    this.context = new TestContext();
    this.cleanupManager = new CleanupManager(this.context);

    if (this.config.isolation?.enabled !== false) {
      const isolationKey = this.config.isolation?.key || `test-${Date.now()}`;
      this.context.setTestIsolation(isolationKey);
    }

    // Initialize factories
    this.userFactory = new UserFactory(this.context, this.cacheManager);
    this.sessionFactory = new SessionFactory(this.context, this.cacheManager);
    this.participantFactory = new ParticipantFactory(this.context, this.cacheManager);
    this.scenarioFactory = new ScenarioFactory(this.context);

    // Initialize API client
    this.apiClient = new EnhancedApiClient();

    // Initialize performance monitoring
    if (this.config.performance?.enabled) {
      this.performanceMonitor = new PerformanceMonitor(this.cacheManager);
    }

    // Setup suite if configured
    if (this.config.suite) {
      const services = this.config.services || [];
      this.suiteContext = await this.suiteManager.setupTestSuite({
        ...this.config.suite,
        services,
      });
    }

    return this;
  }

  /**
   * Start the test server
   */
  async startServer(appFactory?: () => any): Promise<number> {
    if (!this.serverManager) {
      throw new Error('TestServiceBuilder not initialized. Call build() first.');
    }

    const port = await this.serverManager.startServer(appFactory);
    return port;
  }

  /**
   * Stop the test server
   */
  async stopServer(): Promise<void> {
    if (this.serverManager) {
      await this.serverManager.stopServer();
    }
  }

  /**
   * Get current server port
   */
  getPort(): number | undefined {
    return this.serverManager?.getPort();
  }

  /**
   * Create authentication scenario
   */
  async createAuthScenario(userService: any, config?: ScenarioConfig): Promise<AuthScenario> {
    if (!this.scenarioFactory) {
      throw new Error('TestServiceBuilder not initialized. Call build() first.');
    }

    return this.scenarioFactory.createAuthScenario(userService, config);
  }

  /**
   * Create broadcast scenario
   */
  async createBroadcastScenario(
    userService: any,
    sessionService: any,
    participantService: any,
    config?: ScenarioConfig,
  ): Promise<BroadcastScenario> {
    if (!this.scenarioFactory) {
      throw new Error('TestServiceBuilder not initialized. Call build() first.');
    }

    return this.scenarioFactory.createBroadcastScenario(userService, sessionService, participantService, config);
  }

  /**
   * Create P2P scenario
   */
  async createP2PScenario(
    userService: any,
    sessionService: any,
    participantService: any,
    config?: ScenarioConfig,
  ): Promise<P2PScenario> {
    if (!this.scenarioFactory) {
      throw new Error('TestServiceBuilder not initialized. Call build() first.');
    }

    return this.scenarioFactory.createP2PScenario(userService, sessionService, participantService, config);
  }

  /**
   * Create test user
   */
  async createTestUser(
    userService: any,
    email: string,
    password: string = DEFAULT_PASSWORD_STRONG,
    additionalData: any = {},
    makeUnique: boolean = true,
  ): Promise<any> {
    if (!this.userFactory) {
      throw new Error('TestServiceBuilder not initialized. Call build() first.');
    }

    return this.userFactory.createTestUser(userService, email, password, additionalData, makeUnique);
  }

  /**
   * Create test session
   */
  async createTestSession(sessionService: any, type: SessionType, host: any, additionalData: any = {}): Promise<any> {
    if (!this.sessionFactory) {
      throw new Error('TestServiceBuilder not initialized. Call build() first.');
    }

    return this.sessionFactory.createTestSession(sessionService, type, host, additionalData);
  }

  /**
   * Create test participant
   */
  async createTestParticipant(
    participantService: any,
    sessionId: string,
    userId: string,
    additionalData: any = {},
  ): Promise<any> {
    if (!this.participantFactory) {
      throw new Error('TestServiceBuilder not initialized. Call build() first.');
    }

    return this.participantFactory.createTestParticipant(participantService, sessionId, userId, additionalData);
  }

  /**
   * Make authenticated API request
   */
  async makeAuthenticatedRequest(
    port: number,
    endpoint: string,
    token: string,
    body?: any,
    options: {
      method?: string;
      headers?: Record<string, string>;
      retryConfig?: import('../api/enhanced-api-client').RetryConfig;
    } = {},
  ): Promise<any> {
    if (!this.apiClient) {
      throw new Error('TestServiceBuilder not initialized. Call build() first.');
    }

    const response = await this.apiClient.makeAuthenticatedReliableRequest(port, endpoint, token, body, options);
    return response.data || response;
  }

  /**
   * Make reliable API request with retry logic
   */
  async makeReliableRequest(
    port: number,
    endpoint: string,
    body?: any,
    options: {
      method?: string;
      headers?: Record<string, string>;
      expectedStatus?: number;
      retryConfig?: import('../api/enhanced-api-client').RetryConfig;
    } = {},
  ): Promise<any> {
    if (!this.apiClient) {
      throw new Error('TestServiceBuilder not initialized. Call build() first.');
    }

    const response = await this.apiClient.makeReliableApiRequest(port, endpoint, body, options);
    return response.data || response;
  }

  /**
   * Clean up all tracked objects
   */
  async cleanup(): Promise<void> {
    if (this.cleanupManager && this.services.size > 0) {
      await this.cleanupManager.cleanupAll(Object.fromEntries(this.services));
    }

    if (this.suiteContext) {
      await this.suiteManager.teardownTestSuite(this.suiteContext.id);
    }

    this.context?.clearAllTracked();
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return this.cacheManager.getCacheStats();
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics() {
    return this.performanceMonitor?.getEfficiencyMetrics();
  }

  /**
   * Clear all caches
   */
  clearCaches(): void {
    this.cacheManager.clearCache();
  }

  /**
   * Get test context
   */
  getContext(): TestContext | undefined {
    return this.context;
  }

  /**
   * Get API client instance
   */
  getApiClient(): EnhancedApiClient | undefined {
    return this.apiClient;
  }

  /**
   * Check if builder is initialized
   */
  isInitialized(): boolean {
    return !!this.context && !!this.apiClient;
  }
}

/**
 * Global test service builder instance
 */
export const testServiceBuilder = new TestServiceBuilder();

/**
 * Convenience function to create a configured test service builder
 */
export function createTestServiceBuilder(config?: TestServiceBuilderConfig): TestServiceBuilder {
  return new TestServiceBuilder(config);
}
