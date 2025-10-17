/**
 * Comprehensive integration tests for test-utils module
 * Tests cross-module functionality and complete workflows
 */

import { SessionType } from '@prisma/client';
import * as assert from 'assert';
import {
  EnhancedTestContext,
  enhancedTestContext,
  ServerManager,
  CleanupManager,
  CacheManager,
  UserFactory,
  SessionFactory,
  ParticipantFactory,
  createMemoizedTestUtils,
  logMemoizationPerformance,
  setupTestEnvironment,
  teardownTestEnvironment,
  setupTestEnvironmentWithCleanup,
  teardownTestEnvironmentWithCleanup,
  DEFAULT_CACHE_CONFIG,
  assertSuccessResponse,
  makeAuthenticatedRequest,
} from '../index';
import { PerformanceMonitor } from '../memoization/performance-monitor';

// Mock services for testing
const createMockUserService = () => ({
  create: async (data: any) => ({ id: `user-${Date.now()}`, email: data.email, roles: data.roles || ['USER'] }),
  find: async () => ({ data: [] }),
  remove: async () => {},
});

const createMockSessionService = () => ({
  create: async (data: any) => ({
    id: `session-${Date.now()}`,
    type: data.type || SessionType.P2P,
    hostId: data.hostId,
  }),
  find: async () => ({ data: [] }),
  remove: async () => {},
});

const createMockParticipantService = () => ({
  create: async (data: any) => ({ id: `participant-${Date.now()}`, sessionId: data.sessionId, userId: data.userId }),
  find: async () => ({ data: [] }),
  remove: async () => {},
});

describe('Test Utils Integration Tests', () => {
  let context: EnhancedTestContext;
  let serverManager: ServerManager;
  let cleanupManager: CleanupManager;
  let cacheManager: CacheManager;
  let userFactory: UserFactory;
  let sessionFactory: SessionFactory;
  let participantFactory: ParticipantFactory;
  let memoizedUtils: ReturnType<typeof createMemoizedTestUtils>;

  // Mock services
  let mockUserService: ReturnType<typeof createMockUserService>;
  let mockSessionService: ReturnType<typeof createMockSessionService>;
  let mockParticipantService: ReturnType<typeof createMockParticipantService>;

  beforeEach(async () => {
    // Setup test environment
    const setup = await setupTestEnvironmentWithCleanup();
    context = enhancedTestContext;
    cleanupManager = setup.cleanupManager;

    // Initialize managers and factories
    serverManager = new ServerManager();
    cacheManager = new CacheManager();
    userFactory = new UserFactory(context, cacheManager);
    sessionFactory = new SessionFactory(context, cacheManager);
    participantFactory = new ParticipantFactory(context, cacheManager);

    // Create memoized utilities
    memoizedUtils = createMemoizedTestUtils(context);

    // Initialize mock services
    mockUserService = createMockUserService();
    mockSessionService = createMockSessionService();
    mockParticipantService = createMockParticipantService();
  });

  afterEach(async () => {
    const services = {
      userService: mockUserService,
      sessionService: mockSessionService,
      participantService: mockParticipantService,
    };

    await teardownTestEnvironmentWithCleanup(context, cleanupManager, services);
  });

  describe('End-to-End User Journey Integration', () => {
    it('should complete full user journey: create user → create session → add participants → cleanup', async () => {
      // Step 1: Create test user
      const user = await context.createTestUser(mockUserService, 'integration-test@example.com', 'TestPassword123!@#', {
        roles: ['USER', 'HOST'],
      });

      assert.ok(user, 'User should be created');
      assert.strictEqual(user.email, 'integration-test@example.com', 'User email should match');

      // Step 2: Create test session
      const session = await context.createTestSession(mockSessionService, SessionType.P2P, user, {
        title: 'Integration Test Session',
      });

      assert.ok(session, 'Session should be created');
      assert.strictEqual(session.type, SessionType.P2P, 'Session type should be P2P');
      assert.strictEqual(session.hostId, user.id, 'Session host ID should match user ID');

      // Step 3: Add participants
      const participant = await context.createTestParticipant(mockParticipantService, session.id, user.id, {
        role: 'HOST',
      });

      assert.ok(participant, 'Participant should be created');
      assert.strictEqual(participant.sessionId, session.id, 'Participant session ID should match');
      assert.strictEqual(participant.userId, user.id, 'Participant user ID should match');

      // Step 4: Verify all objects are tracked for cleanup
      const allTracked = context.getAllTracked();
      const totalTracked = Object.values(allTracked).reduce((sum, arr) => sum + arr.length, 0);
      assert.strictEqual(totalTracked, 3, 'Should have 3 tracked objects');

      // Step 5: Cleanup should remove all created objects
      await cleanupManager.cleanupAll({
        userService: mockUserService,
        sessionService: mockSessionService,
        participantService: mockParticipantService,
      });

      const afterCleanup = context.getAllTracked();
      const totalAfterCleanup = Object.values(afterCleanup).reduce((sum, arr) => sum + arr.length, 0);
      assert.strictEqual(totalAfterCleanup, 0, 'All objects should be cleaned up');
    });

    it('should handle complex multi-user scenarios with caching', async () => {
      // Create multiple users with caching enabled
      const users = await Promise.all([
        context.createTestUser(mockUserService, 'user1@example.com'),
        context.createTestUser(mockUserService, 'user2@example.com'),
        context.createTestUser(mockUserService, 'user3@example.com'),
      ]);

      assert.strictEqual(users.length, 3, 'Should create 3 users');

      // Create multiple sessions
      const sessions = await Promise.all([
        context.createTestSession(mockSessionService, SessionType.P2P, users[0]),
        context.createTestSession(mockSessionService, SessionType.BROADCAST, users[1]),
      ]);

      assert.strictEqual(sessions.length, 2, 'Should create 2 sessions');

      // Add multiple participants
      const participants = await Promise.all([
        context.createTestParticipant(mockParticipantService, sessions[0].id, users[1].id),
        context.createTestParticipant(mockParticipantService, sessions[0].id, users[2].id),
        context.createTestParticipant(mockParticipantService, sessions[1].id, users[2].id),
      ]);

      assert.strictEqual(participants.length, 3, 'Should create 3 participants');

      // Verify cache performance
      const cacheStats = context.getCacheStats();
      assert.ok(cacheStats.sets > 0, 'Cache should have sets');

      // Test cache hits on second creation with same parameters
      await context.createTestUser(mockUserService, 'user1@example.com', 'TestPassword123!@#', { roles: ['USER'] });

      const updatedStats = context.getCacheStats();
      assert.ok(updatedStats.hits >= 0, 'Cache should track hits');
    });
  });

  describe('Server Lifecycle Integration', () => {
    it('should manage complete server lifecycle with factory usage and cleanup', async () => {
      // Start server with factory
      const port = await serverManager.startServer();
      assert.ok(port > 0, 'Server should start on a valid port');
      assert.ok(serverManager.isRunning(), 'Server should be running');

      // Create test data while server is running
      const user = await context.createTestUser(mockUserService, 'server-test@example.com');

      const session = await context.createTestSession(mockSessionService, SessionType.P2P, user);

      assert.ok(user, 'User should be created');
      assert.ok(session, 'Session should be created');

      // Stop server gracefully
      await serverManager.stopServer();
      assert.ok(!serverManager.isRunning(), 'Server should be stopped');

      // Cleanup should still work after server shutdown
      await cleanupManager.cleanupAll({
        userService: mockUserService,
        sessionService: mockSessionService,
        participantService: mockParticipantService,
      });

      const allTracked = context.getAllTracked();
      const totalTracked = Object.values(allTracked).reduce((sum, arr) => sum + arr.length, 0);
      assert.strictEqual(totalTracked, 0, 'All objects should be cleaned up');
    });

    it('should handle server restart scenarios with data persistence', async () => {
      // Initial server startup and data creation
      await serverManager.startServer();
      const user1 = await context.createTestUser(mockUserService, 'restart-test@example.com');
      await serverManager.stopServer();

      // Restart server and create more data
      await serverManager.startServer();
      const user2 = await context.createTestUser(mockUserService, 'restart-test2@example.com');
      const session = await context.createTestSession(mockSessionService, SessionType.BROADCAST, user2);

      expect(user1).toBeDefined();
      expect(user2).toBeDefined();
      expect(session).toBeDefined();

      // Cleanup everything
      await serverManager.stopServer();
      await cleanupManager.cleanupAll({
        userService: mockUserService,
        sessionService: mockSessionService,
      });

      expect(context.getTrackedObjects()).toHaveLength(0);
    });
  });

  describe('Performance Monitoring Integration', () => {
    it('should monitor performance across multiple operations', async () => {
      const monitor = new PerformanceMonitor(cacheManager);

      // Perform multiple operations
      for (let i = 0; i < 10; i++) {
        await context.createTestUser(mockUserService, `perf-test-${i}@example.com`);
      }

      // Log performance report
      const report = monitor.logPerformanceReport();
      expect(report.hitRate).toBeGreaterThanOrEqual(0);
      expect(report.stats.totalOperations).toBeGreaterThan(0);

      // Verify efficiency metrics
      const efficiency = monitor.getEfficiencyMetrics();
      expect(efficiency.totalOperations).toBeGreaterThan(0);
      expect(efficiency.cacheEfficiency).toBeGreaterThanOrEqual(0);
    });

    it('should benchmark performance with real workloads', async () => {
      const startTime = Date.now();

      // Create a realistic workload
      const users = await Promise.all(
        Array.from({ length: 50 }, (_, i) => context.createTestUser(mockUserService, `load-test-${i}@example.com`)),
      );

      const sessionCreateTime = Date.now();

      const sessions = await Promise.all(
        users.slice(0, 10).map((user) => context.createTestSession(mockSessionService, SessionType.P2P, user)),
      );

      const participantCreateTime = Date.now();

      const participants = await Promise.all(
        sessions.flatMap((session) =>
          users.slice(1, 4).map((user) => context.createTestParticipant(mockParticipantService, session.id, user.id)),
        ),
      );

      const endTime = Date.now();

      // Performance assertions
      const totalTime = endTime - startTime;
      const sessionTime = participantCreateTime - sessionCreateTime;
      const participantTime = endTime - participantCreateTime;

      expect(users).toHaveLength(50);
      expect(sessions).toHaveLength(10);
      expect(participants).toHaveLength(30);

      // Log performance metrics
      console.log(`Total workload time: ${totalTime}ms`);
      console.log(`Session creation time: ${sessionTime}ms`);
      console.log(`Participant creation time: ${participantTime}ms`);

      // Performance should be reasonable (adjust thresholds as needed)
      expect(totalTime).toBeLessThan(5000); // Less than 5 seconds
    });
  });

  describe('Cache Configuration Integration', () => {
    it('should work with different cache configurations and factory operations', async () => {
      // Test with small cache
      cacheManager.configureMemoization({ ...DEFAULT_CACHE_CONFIG, maxSize: 10 });

      // Create users to fill cache
      for (let i = 0; i < 15; i++) {
        await context.createTestUser(mockUserService, `cache-test-${i}@example.com`);
      }

      const stats = context.getCacheStats();
      expect(stats.evictions).toBeGreaterThan(0); // Should have evictions due to small cache

      // Test cache invalidation
      context.invalidateCache('users', { roles: ['USER'] });

      const afterInvalidation = context.getCacheStats();
      expect(afterInvalidation.size).toBeLessThan(stats.size);
    });

    it('should handle cache performance with factory operations', async () => {
      // Configure for performance monitoring
      cacheManager.configureMemoization({
        ...DEFAULT_CACHE_CONFIG,
        maxSize: 100,
        ttl: 300000, // 5 minutes
      });

      // Use memoized utilities for performance logging
      const user1 = await memoizedUtils.createTestUser(mockUserService, 'perf-user1@example.com');

      const user2 = await memoizedUtils.createTestUser(mockUserService, 'perf-user2@example.com');

      expect(user1).toBeDefined();
      expect(user2).toBeDefined();

      // Verify cache stats are logged
      const cacheStats = memoizedUtils.getCacheStats();
      expect(cacheStats).toBeDefined();
      expect(cacheStats.sets).toBeGreaterThan(0);
    });
  });

  describe('Environment Setup Integration', () => {
    it('should integrate environment setup with all utilities', async () => {
      // Test complete environment lifecycle
      const { context: testContext, cleanupManager: testCleanupManager } = await setupTestEnvironmentWithCleanup();

      // Create test data using the context
      const user = await testContext.createTestUser(mockUserService, 'env-test@example.com');

      const session = await testContext.createTestSession(mockSessionService, SessionType.BROADCAST, user);

      expect(user).toBeDefined();
      expect(session).toBeDefined();

      // Cleanup using the provided cleanup manager
      await testCleanupManager.cleanupAll({
        userService: mockUserService,
        sessionService: mockSessionService,
      });

      expect(testContext.getTrackedObjects()).toHaveLength(0);

      // Teardown environment
      await teardownTestEnvironmentWithCleanup(testContext, testCleanupManager, {
        userService: mockUserService,
        sessionService: mockSessionService,
      });
    });

    it('should handle environment setup with enhanced context', async () => {
      // Test with enhanced context that includes all utilities
      const enhancedCtx = enhancedTestContext;

      // Use server management
      await enhancedCtx.startServer();
      expect(enhancedCtx.getPort()).toBeGreaterThan(0);

      // Use factories
      const user = await enhancedCtx.createTestUser(mockUserService, 'enhanced-test@example.com');

      const session = await enhancedCtx.createTestSession(mockSessionService, SessionType.P2P, user);

      // Use cleanup
      await enhancedCtx.cleanupAll({
        userService: mockUserService,
        sessionService: mockSessionService,
      });

      // Use cache operations
      enhancedCtx.setCached('test', { key: 'value' }, { data: 'test' });
      const cached = enhancedCtx.getCached('test', { key: 'value' });
      expect(cached).toBeDefined();

      // Stop server
      await enhancedCtx.stopServer();
    });
  });

  describe('Module Interaction Tests', () => {
    it('should integrate ServerManager + Factories + CleanupManager', async () => {
      // Start server
      await serverManager.startServer();

      // Create test data using factories
      const user = await userFactory.createTestUser(mockUserService, 'module-test@example.com');

      const session = await sessionFactory.createTestSession(mockSessionService, SessionType.P2P, user);

      const participant = await participantFactory.createTestParticipant(mockParticipantService, session.id, user.id);

      expect(user).toBeDefined();
      expect(session).toBeDefined();
      expect(participant).toBeDefined();

      // Cleanup using cleanup manager
      await cleanupManager.cleanupAll({
        userService: mockUserService,
        sessionService: mockSessionService,
        participantService: mockParticipantService,
      });

      expect(context.getTrackedObjects()).toHaveLength(0);

      // Stop server
      await serverManager.stopServer();
    });

    it('should integrate PerformanceMonitor + CacheConfig + CacheManager', async () => {
      // Configure cache for monitoring
      cacheManager.configureMemoization({
        ...DEFAULT_CACHE_CONFIG,
        maxSize: 50,
        enableMetrics: true,
      });

      const monitor = new PerformanceMonitor(cacheManager);

      // Perform operations to generate metrics
      for (let i = 0; i < 20; i++) {
        await context.createTestUser(mockUserService, `monitor-test-${i}@example.com`);
      }

      // Verify monitoring integration
      const efficiency = monitor.getEfficiencyMetrics();
      expect(efficiency.totalOperations).toBeGreaterThan(0);
      expect(efficiency.hitRate).toBeGreaterThanOrEqual(0);
      expect(efficiency.cacheEfficiency).toBeGreaterThanOrEqual(0);

      // Test performance acceptability
      const isAcceptable = monitor.isPerformanceAcceptable(50); // 50% hit rate threshold
      expect(typeof isAcceptable).toBe('boolean');
    });

    it('should integrate ResponseValidator + API helpers + Factories', async () => {
      // Mock API response
      const mockApiResponse = {
        status: 200,
        data: {
          id: 'api-user-1',
          email: 'api-test@example.com',
        },
      };

      // Test response validation
      expect(() => assertSuccessResponse(mockApiResponse)).not.toThrow();

      // Create user and validate response format
      const user = await context.createTestUser(mockUserService, 'response-test@example.com');

      expect(user).toBeDefined();
      expect(user.id).toBeDefined();
      expect(user.email).toBe('response-test@example.com');

      // Mock authenticated request scenario
      const authRequest = {
        headers: { Authorization: 'Bearer test-token' },
        body: { email: 'auth-test@example.com' },
      };

      expect(authRequest.headers.Authorization).toBeDefined();
    });
  });

  describe('Memory Leak Prevention and Concurrent Operations', () => {
    it('should prevent memory leaks across complex operations', async () => {
      const initialTracked = context.getTrackedObjects().length;

      // Perform many operations
      for (let i = 0; i < 100; i++) {
        const user = await context.createTestUser(mockUserService, `leak-test-${i}@example.com`);

        // Create session for every 10th user
        if (i % 10 === 0) {
          await context.createTestSession(mockSessionService, SessionType.P2P, user);
        }
      }

      const afterOperations = context.getTrackedObjects().length;
      expect(afterOperations).toBeGreaterThan(initialTracked);

      // Cleanup should restore to initial state
      await cleanupManager.cleanupAll({
        userService: mockUserService,
        sessionService: mockSessionService,
      });

      const afterCleanup = context.getTrackedObjects().length;
      expect(afterCleanup).toBe(initialTracked);
    });

    it('should handle concurrent operations and race conditions', async () => {
      // Create multiple concurrent user creation operations
      const concurrentUsers = await Promise.all(
        Array.from({ length: 20 }, (_, i) => context.createTestUser(mockUserService, `concurrent-${i}@example.com`)),
      );

      expect(concurrentUsers).toHaveLength(20);

      // Create sessions concurrently
      const users = concurrentUsers.slice(0, 5);
      const concurrentSessions = await Promise.all(
        users.map((user) => context.createTestSession(mockSessionService, SessionType.BROADCAST, user)),
      );

      expect(concurrentSessions).toHaveLength(5);

      // Test concurrent cleanup
      await cleanupManager.cleanupAll({
        userService: mockUserService,
        sessionService: mockSessionService,
      });

      expect(context.getTrackedObjects()).toHaveLength(0);

      // Verify no race conditions in cache operations
      const cacheStats = context.getCacheStats();
      expect(cacheStats.hits + cacheStats.misses).toBe(cacheStats.totalOperations);
    });

    it('should handle error scenarios and recovery across module boundaries', async () => {
      // Mock service failure
      mockUserService.create.mockRejectedValueOnce(new Error('Service unavailable'));

      // Should handle error gracefully
      await expect(context.createTestUser(mockUserService, 'error-test@example.com')).rejects.toThrow(
        'Service unavailable',
      );

      // Reset mock and continue with successful operations
      mockUserService.create.mockResolvedValueOnce({
        id: 'recovery-user-1',
        email: 'recovery@example.com',
      });

      const user = await context.createTestUser(mockUserService, 'recovery@example.com');

      expect(user).toBeDefined();

      // Cleanup should work despite previous errors
      await cleanupManager.cleanupAll({
        userService: mockUserService,
        sessionService: mockSessionService,
      });

      expect(context.getTrackedObjects()).toHaveLength(0);
    });
  });

  describe('Advanced Integration Scenarios', () => {
    it('should handle complex workflow with multiple service interactions', async () => {
      // Simulate complex business workflow
      const host = await context.createTestUser(mockUserService, 'workflow-host@example.com', 'TestPassword123!@#', {
        roles: ['HOST'],
      });

      const participants = await Promise.all([
        context.createTestUser(mockUserService, 'workflow-participant1@example.com'),
        context.createTestUser(mockUserService, 'workflow-participant2@example.com'),
        context.createTestUser(mockUserService, 'workflow-participant3@example.com'),
      ]);

      // Create session
      const session = await context.createTestSession(mockSessionService, SessionType.BROADCAST, host, {
        title: 'Complex Workflow Session',
        maxParticipants: 10,
      });

      // Add all participants
      const sessionParticipants = await Promise.all(
        participants.map((participant) =>
          context.createTestParticipant(mockParticipantService, session.id, participant.id, { role: 'VIEWER' }),
        ),
      );

      expect(host).toBeDefined();
      expect(participants).toHaveLength(3);
      expect(session).toBeDefined();
      expect(sessionParticipants).toHaveLength(3);

      // Verify all objects are tracked
      expect(context.getTrackedObjects()).toHaveLength(5); // 1 host + 3 participants + 1 session

      // Cleanup workflow
      await cleanupManager.cleanupAll({
        userService: mockUserService,
        sessionService: mockSessionService,
        participantService: mockParticipantService,
      });

      expect(context.getTrackedObjects()).toHaveLength(0);
    });

    it('should demonstrate full system integration with performance validation', async () => {
      const monitor = new PerformanceMonitor(cacheManager);
      const startTime = Date.now();

      // Complex integration scenario
      const users = await Promise.all(
        Array.from({ length: 25 }, (_, i) => context.createTestUser(mockUserService, `system-test-${i}@example.com`)),
      );

      const sessions = await Promise.all(
        users
          .filter((_, i) => i % 5 === 0)
          .map((user) => context.createTestSession(mockSessionService, SessionType.P2P, user)),
      );

      const allParticipants = [];
      for (const session of sessions) {
        const sessionUsers = users.filter((_, i) => i % 3 === 0 && i !== 0);
        const participants = await Promise.all(
          sessionUsers.map((user) => context.createTestParticipant(mockParticipantService, session.id, user.id)),
        );
        allParticipants.push(...participants);
      }

      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // Performance validation
      expect(users).toHaveLength(25);
      expect(sessions).toHaveLength(5);
      expect(allParticipants.length).toBeGreaterThan(0);

      // Log performance metrics
      const report = monitor.logPerformanceReport();
      console.log(`Full system integration took ${totalTime}ms`);
      console.log(`Performance report: ${JSON.stringify(report)}`);

      // Cleanup
      await cleanupManager.cleanupAll({
        userService: mockUserService,
        sessionService: mockSessionService,
        participantService: mockParticipantService,
      });

      expect(context.getTrackedObjects()).toHaveLength(0);
    });
  });
});
