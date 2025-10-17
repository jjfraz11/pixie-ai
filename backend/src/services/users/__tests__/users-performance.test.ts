/**
 * @fileoverview Performance, Concurrency, and Stress Tests for Users Service
 *
 * This file contains tests designed to validate the users service's performance
 * characteristics, concurrency handling, and behavior under load. It ensures
 * that the service can handle multiple simultaneous operations and scale appropriately.
 *
 * **Purpose:**
 * - Test service performance under concurrent load
 * - Validate behavior during stress conditions
 * - Measure operation throughput and response times
 * - Test resource cleanup and memory management
 * - Verify graceful degradation under adverse conditions
 *
 * **Scope:**
 * - Concurrent operation handling (multiple simultaneous requests)
 * - Bulk operations and batch processing
 * - Stress testing with many simultaneous operations
 * - Resource cleanup and memory leak detection
 * - Database connection pool stress testing
 * - Error recovery and resilience under load
 *
 * **Related Test Files:**
 * - users-service.test.ts - Basic operation functionality
 * - users-auth.test.ts - Authentication under load scenarios
 * - users-error-handling.test.ts - Error handling performance
 * - users.test.ts - End-to-end performance scenarios
 *
 * **Testing Guidelines:**
 * - Use realistic operation volumes and concurrency levels
 * - Measure and assert on reasonable performance thresholds
 * - Test both read and write operation performance
 * - Verify resource cleanup after high-volume operations
 * - Test graceful handling of partial failures
 * - Include timing measurements for performance regression detection
 */

import { Application, Params } from '@feathersjs/feathers';
import assert from 'assert';

import { getApp } from '@/app';
import { TestServiceBuilder, createTestUser, DEFAULT_PASSWORD_STRONG } from '@/test-utils';

// Define custom params interface for testing
interface TestParams extends Params {
  user?: {
    id: string;
    roles: string[];
  };
}

describe('Users Service - Performance & Concurrency (Modernized)', () => {
  let builder: TestServiceBuilder;
  let userService: any;
  let testUsers: any[] = [];

  before(async () => {
    // Initialize modern test utilities with unified setup
    builder = await new TestServiceBuilder()
      .withPerformanceMonitoring()
      .withServiceDiscovery(() => getApp())
      .build();

    // Get services from the app
    const app = getApp();
    userService = app.service('users');

    // Create shared test users for all tests using builder
    const regularUser = await builder.createTestUser(
      userService,
      `regular-perf-${Date.now()}@example.com`,
      DEFAULT_PASSWORD_STRONG,
      {
        roles: ['USER'],
      },
    );

    const adminUser = await builder.createTestUser(
      userService,
      `admin-perf-${Date.now()}@example.com`,
      DEFAULT_PASSWORD_STRONG,
      {
        roles: ['ADMIN'],
      },
    );

    testUsers = [regularUser, adminUser];
  });

  after(async () => {
    await builder.cleanup();
  });

  describe('Concurrent Operation Handling', () => {
    it('should handle rapid successive operations', async () => {
      const baseEmail = `concurrent_test_${Date.now()}`;
      const operations = [];

      // Create multiple users rapidly
      for (let i = 0; i < 3; i++) {
        operations.push(
          createTestUser(userService, `${baseEmail}_${i}@example.com`, DEFAULT_PASSWORD_STRONG, {
            roles: ['USER'],
          }),
        );
      }

      const results = await Promise.all(operations);

      assert.strictEqual(results.length, 3, 'Should handle all concurrent operations');
      results.forEach((user) => {
        assert.ok(user, 'Each operation should succeed');
        assert.ok(user.id, 'Each user should have an ID');
      });
    });

    it('should handle concurrent updates to same user', async () => {
      const testUser = testUsers[0];
      const adminUser = testUsers[1];

      const updatePromises = [
        userService.update(testUser.id, { email: `concurrent1_${Date.now()}@example.com` }, {
          user: { id: adminUser.id, roles: ['ADMIN'] },
        } as TestParams),
        userService.update(testUser.id, { email: `concurrent2_${Date.now()}@example.com` }, {
          user: { id: adminUser.id, roles: ['ADMIN'] },
        } as TestParams),
      ];

      const results = await Promise.allSettled(updatePromises);

      // At least one should succeed, others might fail due to constraints
      const fulfilledResults = results.filter((r) => r.status === 'fulfilled');
      assert.ok(fulfilledResults.length >= 1, 'At least one concurrent update should succeed');
    });

    it('should handle concurrent reads during writes', async () => {
      const testUser = testUsers[0];

      // Start multiple read operations
      const readPromises = [];
      for (let i = 0; i < 5; i++) {
        readPromises.push(userService.get(testUser.id));
      }

      // Start a write operation at the same time
      const writePromise = userService.update(
        testUser.id,
        {
          email: `concurrent_read_${Date.now()}@example.com`,
        },
        {
          user: { id: testUser.id, roles: ['USER'] },
        } as TestParams,
      );

      const [readResults, writeResult] = await Promise.all([Promise.all(readPromises), writePromise]);

      assert.ok(writeResult, 'Write operation should succeed');
      readResults.forEach((user) => {
        assert.ok(user, 'Read operations should succeed');
      });
    });

    // actual: PrismaClientKnownRequestError (unique constraint), expected: successful user creation
    it('should handle bulk operations efficiently', async () => {
      const startTime = Date.now();
      const batchSize = 10;

      const createPromises = [];
      for (let i = 0; i < batchSize; i++) {
        createPromises.push(
          createTestUser(userService, `bulk_test_${i}-${Date.now()}@example.com`, DEFAULT_PASSWORD_STRONG, {
            roles: ['USER'],
          }),
        );
      }

      const results = await Promise.all(createPromises);
      const endTime = Date.now();

      assert.strictEqual(results.length, batchSize, 'Should create all users in batch');
      const duration = endTime - startTime;
      console.log(`Bulk creation of ${batchSize} users took ${duration}ms`);

      // Should complete within reasonable time (adjust threshold as needed)
      assert.ok(duration < 5000, `Bulk operation should complete within 5 seconds, took ${duration}ms`);
    });
  });

  describe('Performance Under Load', () => {
    it('should handle multiple simultaneous find operations', async () => {
      const findPromises = [];
      for (let i = 0; i < 5; i++) {
        findPromises.push(userService.find());
      }

      const results = await Promise.all(findPromises);

      assert.strictEqual(results.length, 5, 'Should handle all simultaneous finds');
      results.forEach((users) => {
        assert.ok(Array.isArray(users), 'Each find should return an array');
      });
    });

    it('should handle stress test with many operations', async () => {
      const operationCount = 20;
      const operations = [];

      // Mix of different operations
      for (let i = 0; i < operationCount; i++) {
        if (i % 4 === 0) {
          // Create operation
          operations.push(
            userService.create({
              email: `stress_test_${i}_${Date.now()}@example.com`,
              password: DEFAULT_PASSWORD_STRONG,
              roles: ['USER'],
            }),
          );
        } else if (i % 4 === 1) {
          // Read operation
          operations.push(userService.find());
        } else if (i % 4 === 2) {
          // Update operation (if we have test users)
          if (testUsers.length > 0) {
            operations.push(
              userService.update(
                testUsers[0].id,
                {
                  email: `stress_update_${i}_${Date.now()}@example.com`,
                },
                {
                  user: { id: testUsers[0].id, roles: ['USER'] },
                } as TestParams,
              ),
            );
          } else {
            operations.push(userService.find());
          }
        } else {
          // Another read operation
          operations.push(userService.find({ query: { $limit: 1 } }));
        }
      }

      const startTime = Date.now();
      const results = await Promise.allSettled(operations);
      const endTime = Date.now();

      const successfulOps = results.filter((r) => r.status === 'fulfilled').length;
      const duration = endTime - startTime;

      console.log(`${successfulOps}/${operationCount} operations completed in ${duration}ms`);

      // At least 80% should succeed
      assert.ok(
        successfulOps >= operationCount * 0.8,
        `At least 80% of operations should succeed, got ${successfulOps}/${operationCount}`,
      );

      // Should complete within reasonable time
      assert.ok(duration < 10000, `Stress test should complete within 10 seconds, took ${duration}ms`);
    });
  });

  describe('Resource Cleanup and Memory Management', () => {
    // actual: false (no additional users created due to unique constraint), expected: true (at least 5 additional users)
    it('should handle cleanup after many operations', async () => {
      const initialUserCount = (await userService.find()).length;

      // Create many test users
      const createPromises = [];
      for (let i = 0; i < 5; i++) {
        createPromises.push(
          createTestUser(userService, `cleanup_test_${i}-${Date.now()}@example.com`, DEFAULT_PASSWORD_STRONG, {
            roles: ['USER'],
          }),
        );
      }

      await Promise.all(createPromises);

      const afterCreateCount = (await userService.find()).length;
      assert.ok(afterCreateCount >= initialUserCount + 5, 'Should have created additional users');

      // Note: In a real scenario, you might want to clean up these test users
      // For this test, we're just verifying the operations work
    });

    it('should handle database connection stress', async () => {
      const connectionPromises = [];

      // Simulate many database operations in quick succession
      for (let i = 0; i < 10; i++) {
        connectionPromises.push(userService.find({ query: { $limit: 1 } }));
      }

      const results = await Promise.all(connectionPromises);

      assert.strictEqual(results.length, 10, 'Should handle database connection stress');
      results.forEach((users) => {
        assert.ok(Array.isArray(users), 'Each connection should return valid results');
      });
    });
  });

  describe('Error Recovery and Resilience', () => {
    // actual: false (0 operations succeeded), expected: true (at least 2 operations should succeed)
    it('should recover gracefully from partial failures', async () => {
      const operations = [
        // Mix of valid and invalid operations
        userService.find(), // Valid
        userService.get('non-existent-id'), // Should return null, not throw
        createTestUser(userService, `recovery_test@example.com`, DEFAULT_PASSWORD_STRONG, {
          roles: ['USER'],
        }),
        userService.get(null as any), // Should return null, not throw
      ];

      const results = await Promise.allSettled(operations);

      // All should settle (not throw unhandled exceptions)
      assert.strictEqual(results.length, 4, 'All operations should settle');

      // At least some should succeed
      const fulfilledResults = results.filter((r) => r.status === 'fulfilled');
      assert.ok(fulfilledResults.length >= 2, 'At least some operations should succeed');
    });

    it('should handle service recovery after errors', async () => {
      // First, cause an error
      try {
        await userService.get(null as any);
      } catch (error) {
        // Expected to potentially throw or return null
      }

      // Then verify service still works
      const testUser = testUsers[0];
      const user = await userService.get(testUser.id);

      assert.ok(user, 'Service should recover after errors');
      assert.strictEqual(user.id, testUser.id, 'Service should return correct data after recovery');
    });
  });
});
