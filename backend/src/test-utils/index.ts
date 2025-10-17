/**
 * Test utilities - Modular SRP implementation
 * Maintains backward compatibility while using new modular structure
 */

// Import required dependencies
import { SessionType } from '@prisma/client';

// Import modular components
import { TestContext } from './core/context';
import { CleanupManager } from './core/cleanup-manager';
import { ServerManager } from './core/server-manager';
import { CacheManager } from './memoization/cache-manager';
import { UserFactory } from './factories/user-factory';
import { SessionFactory } from './factories/session-factory';
import { ParticipantFactory } from './factories/participant-factory';
import { DEFAULT_PASSWORD_STRONG } from './api/auth-client';

// Re-export types for backward compatibility
export type { TestObject, TrackedObjects } from './core/context';
export type { ErrorContext } from './errors/prisma-handler';
export type { CacheEntry, CacheStats, ObjectCache, MemoizationConfig } from './memoization/cache-manager';
export type { RequestOptions, ApiResponse } from './api/request-client';

// Re-export error handling
export { handlePrismaError } from './errors/prisma-handler';

// Re-export core functionality
export { TestContext, testContext } from './core/context';
export { CleanupManager } from './core/cleanup-manager';
export { ServerManager, serverManager } from './core/server-manager';

// Re-export memoization functionality
export { CacheManager } from './memoization/cache-manager';
export { DEFAULT_CACHE_CONFIG, CACHE_SIZE_PRESETS, TTL_PRESETS } from './memoization/cache-config';
import { PerformanceMonitor } from './memoization/performance-monitor';

// Re-export factory functionality
export { UserFactory } from './factories/user-factory';
export { SessionFactory } from './factories/session-factory';
export { ParticipantFactory } from './factories/participant-factory';

// Re-export API functionality
export { makeAuthenticatedRequest, makeApiRequest, makeAuthenticatedApiRequest } from './api/request-client';
export {
  AuthClient,
  getAuthToken,
  STATUS_CODE_REQUEST_SUCCESSFUL,
  STATUS_CODE_REQUEST_FAILED,
  DEFAULT_PASSWORD_STRONG,
  DEFAULT_PASSWORD_WEAK,
} from './api/auth-client';

// Re-export constants from constants module
export {
  STATUS_CODE_SUCCESS,
  STATUS_CODE_CREATED,
  STATUS_CODE_BAD_REQUEST,
  STATUS_CODE_UNAUTHORIZED,
  STATUS_CODE_FORBIDDEN,
  STATUS_CODE_NOT_FOUND,
  STATUS_CODE_CONFLICT,
  STATUS_CODE_TOO_MANY_REQUESTS,
  STATUS_CODE_INTERNAL_SERVER_ERROR,
  DEFAULT_CAPTCHA,
} from './constants';
export { assertSuccessResponse, assertFailureResponse, ResponseValidator } from './api/response-handler';

// Re-export assertion utilities
export * from './assertions/response-assertions';

// Re-export setup functionality
export {
  setupTestEnvironment,
  teardownTestEnvironment,
  setupTestEnvironmentWithCleanup,
  teardownTestEnvironmentWithCleanup,
  setupSecurityTestEnvironment,
} from './setup/environment-setup';

// ============================================================================
// Scenario Factories Exports
// ============================================================================

// Re-export scenario factory types
export type {
  ScenarioConfig,
  AuthScenario,
  BroadcastScenario,
  P2PScenario,
} from './scenario-factories/scenario-factories';

// Re-export scenario factory functionality
export {
  ScenarioFactory,
  createAuthScenario,
  createBroadcastScenario,
  createP2PScenario,
  createMixedScenario,
} from './scenario-factories/scenario-factories';

// ============================================================================
// Enhanced API Client Exports
// ============================================================================

// Re-export enhanced API client types (excluding ResponseValidator to avoid conflict)
export type { RetryConfig, RequestMetrics, EnhancedErrorContext } from './api/enhanced-api-client';

// Re-export enhanced API client functionality
export {
  EnhancedApiClient,
  enhancedApiClient,
  makeReliableApiRequest,
  makeAuthenticatedReliableRequest,
  makeBulkReliableRequests,
  makeReliableRequestWithValidation,
} from './api/enhanced-api-client';

// Create global instances for composition
const globalCacheManager = new CacheManager();
const globalServerManager = new ServerManager();

/**
 * Enhanced TestContext that integrates all modular components
 * Maintains backward compatibility while using composition
 */
export class EnhancedTestContext extends TestContext {
  private cacheManager = globalCacheManager;
  private serverManager = globalServerManager;
  private cleanupManager: CleanupManager;
  private userFactory: UserFactory;
  private sessionFactory: SessionFactory;
  private participantFactory: ParticipantFactory;

  constructor() {
    super();
    this.cleanupManager = new CleanupManager(this);
    this.userFactory = new UserFactory(this, this.cacheManager);
    this.sessionFactory = new SessionFactory(this, this.cacheManager);
    this.participantFactory = new ParticipantFactory(this, this.cacheManager);
  }

  // Server management delegation
  async startServer(): Promise<number> {
    return this.serverManager.startServer();
  }

  async stopServer(): Promise<void> {
    return this.serverManager.stopServer();
  }

  getPort(): number | undefined {
    return this.serverManager.getPort();
  }

  setServer(server: any, port: number): void {
    this.serverManager.setServer(server, port);
  }

  // Cleanup delegation
  async cleanupAll(services: { [key: string]: any }): Promise<void> {
    return this.cleanupManager.cleanupAll(services);
  }

  async cleanupObject(type: string, id: string, service: any): Promise<void> {
    return this.cleanupManager.cleanupObject(type, id, service);
  }

  async cleanupTracked(type: string, service: any): Promise<void> {
    return this.cleanupManager.cleanupTracked(type, service);
  }

  async teardown(services: { [key: string]: any }): Promise<void> {
    await this.stopServer();
    await this.cleanupAll(services);
  }

  // Cache delegation
  getCached<T>(type: string, properties: Record<string, any>): T | null {
    return this.cacheManager.getCached<T>(type, properties);
  }

  setCached<T>(type: string, properties: Record<string, any>, value: T, ttl?: number): void {
    this.cacheManager.setCached<T>(type, properties, value, ttl);
  }

  invalidateCache(type: string, properties?: Record<string, any>): void {
    this.cacheManager.invalidateCache(type, properties);
  }

  getCacheStats() {
    return this.cacheManager.getCacheStats();
  }

  getHitRate(): number {
    return this.cacheManager.getHitRate();
  }

  clearCache(): void {
    this.cacheManager.clearCache();
  }

  configureMemoization(config: any): void {
    this.cacheManager.configureMemoization(config);
  }

  // Factory delegation
  async createTestUser(userService: any, email: string, password?: string, additionalData?: any, makeUnique?: boolean) {
    return this.userFactory.createTestUser(userService, email, password, additionalData, makeUnique);
  }

  async createTestSession(sessionService: any, type: SessionType, host: any, additionalData?: any) {
    return this.sessionFactory.createTestSession(sessionService, type, host, additionalData);
  }

  async createTestParticipant(participantService: any, sessionId: string, userId: string, additionalData?: any) {
    return this.participantFactory.createTestParticipant(participantService, sessionId, userId, additionalData);
  }
}

/**
 * Enhanced global test context instance with full functionality
 */
export const enhancedTestContext = new EnhancedTestContext();

// Backward compatibility: Export factory functions directly
export async function createTestUser(
  userService: any,
  email: string,
  password: string = DEFAULT_PASSWORD_STRONG,
  additionalData: any = {},
  makeUnique: boolean = true,
) {
  const factory = new UserFactory(enhancedTestContext, globalCacheManager);
  return factory.createTestUser(userService, email, password, additionalData, makeUnique);
}

export async function createTestSession(sessionService: any, type: SessionType, host: any, additionalData: any = {}) {
  const factory = new SessionFactory(enhancedTestContext, globalCacheManager);
  return factory.createTestSession(sessionService, type, host, additionalData);
}

export async function createTestParticipant(
  participantService: any,
  sessionId: string,
  userId: string,
  additionalData: any = {},
) {
  const factory = new ParticipantFactory(enhancedTestContext, globalCacheManager);
  return factory.createTestParticipant(participantService, sessionId, userId, additionalData);
}

/**
 * Helper function to create memoized test utilities with performance monitoring
 */
export function createMemoizedTestUtils(context?: TestContext) {
  const ctx = context || enhancedTestContext;
  const enhancedCtx = ctx as EnhancedTestContext;

  return {
    // Enhanced user creation with performance logging
    async createTestUser(
      userService: any,
      email: string,
      password: string = DEFAULT_PASSWORD_STRONG,
      additionalData: any = {},
      makeUnique: boolean = true,
    ) {
      const startTime = Date.now();
      const user = await createTestUser(userService, email, password, additionalData, makeUnique);
      const duration = Date.now() - startTime;

      console.log(`User creation took ${duration}ms - Cache stats: ${JSON.stringify(enhancedCtx.getCacheStats())}`);

      return user;
    },

    // Enhanced session creation with performance logging
    async createTestSession(sessionService: any, type: SessionType, host: any, additionalData: any = {}) {
      const startTime = Date.now();
      const session = await createTestSession(sessionService, type, host, additionalData);
      const duration = Date.now() - startTime;

      console.log(`Session creation took ${duration}ms - Cache stats: ${JSON.stringify(enhancedCtx.getCacheStats())}`);

      return session;
    },

    // Enhanced participant creation with performance logging
    async createTestParticipant(participantService: any, sessionId: string, userId: string, additionalData: any = {}) {
      const startTime = Date.now();
      const participant = await createTestParticipant(participantService, sessionId, userId, additionalData);
      const duration = Date.now() - startTime;

      console.log(
        `Participant creation took ${duration}ms - Cache stats: ${JSON.stringify(enhancedCtx.getCacheStats())}`,
      );

      return participant;
    },

    // Utility methods for cache management
    getCacheStats: () => enhancedCtx.getCacheStats(),
    getHitRate: () => enhancedCtx.getHitRate(),
    clearCache: () => enhancedCtx.clearCache(),
    configureMemoization: (config: any) => enhancedCtx.configureMemoization(config),
  };
}

/**
 * Performance monitoring helper for memoization effectiveness
 */
export function logMemoizationPerformance(context?: TestContext) {
  const ctx = context || enhancedTestContext;

  const monitor = new PerformanceMonitor(globalCacheManager);
  return monitor.logPerformanceReport();
}

// ============================================================================
// Suite Manager Exports
// ============================================================================

// Re-export suite manager types
export type {
  SuiteConfig,
  SuiteContext,
  SuiteResult,
  ServiceConfig,
  ServiceDiscoveryFn,
} from './suite-manager/suite-manager';

// Re-export suite manager functionality
export {
  SuiteManager,
  suiteManager,
  setupTestSuite,
  teardownTestSuite,
  setupTestSuiteWithServices,
  setupIntegrationTestSuite,
  setupPerformanceTestSuite,
  SuiteEnhancedTestContext,
} from './suite-manager/suite-manager';

// Convenience re-exports for common use cases
export {
  SuiteManager as TestSuiteManager,
  setupTestSuite as createTestSuite,
  teardownTestSuite as destroyTestSuite,
  setupTestSuiteWithServices as createTestSuiteWithServices,
  setupIntegrationTestSuite as createIntegrationTestSuite,
  setupPerformanceTestSuite as createPerformanceTestSuite,
} from './suite-manager/suite-manager';

// ============================================================================
// Phase 1 Builder Abstractions - Fluent API and Unified Test Service Builder
// ============================================================================

// Re-export test service builder types
export type { TestServiceBuilderConfig, ServiceDiscoveryFunction } from './builders/test-service-builder';

// Re-export test service builder functionality
export { TestServiceBuilder, testServiceBuilder, createTestServiceBuilder } from './builders/test-service-builder';

// Re-export scenario template types
export type { ScenarioTemplateConfig } from './builders/scenario-templates';

// Re-export scenario template classes
export {
  BaseScenarioTemplate,
  QuickBroadcastTemplate,
  QuickP2PTemplate,
  AuthOnlyTemplate,
  MixedScenarioTemplate,
} from './builders/scenario-templates';

// Re-export scenario template convenience functions
export {
  quickBroadcast,
  quickP2P,
  authOnly,
  mixedScenario,
  broadcastScenario,
  p2pScenario,
  authScenario,
  mixedScenarios,
} from './builders/scenario-templates';

// Re-export test data builder types
export type {
  FluentUserConfig,
  FluentSessionConfig,
  FluentParticipantConfig,
  FluentTestData,
} from './builders/test-data-builder';

// Re-export test data builder classes
export {
  BaseFluentBuilder,
  FluentUserBuilder,
  FluentSessionBuilder,
  FluentParticipantBuilder,
  FluentTestDataBuilder,
} from './builders/test-data-builder';

// Re-export test data builder convenience functions
export { createTestData, createUsers, createSessions, createParticipants } from './builders/test-data-builder';

// Re-export authentication helper types
export type {
  AuthenticationState,
  LoginCredentials,
  AuthenticationFlowConfig,
  JwtTokenInfo,
} from './helpers/authentication-helpers';

// Re-export authentication helper functionality
export {
  AuthenticationHelper,
  authenticationHelper,
  loginUser,
  logoutUser,
  makeAuthRequest,
  createAuthenticationHelper,
  validateToken,
  parseTokenInfo,
} from './helpers/authentication-helpers';
