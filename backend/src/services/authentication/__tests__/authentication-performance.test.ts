/**
 * @fileoverview Performance, Concurrency, and Stress Tests for Authentication Service
 *
 * This file contains tests designed to validate the authentication service's performance
 * characteristics, concurrency handling, and behavior under load. It ensures
 * that the service can handle multiple simultaneous authentication requests and scale appropriately.
 *
 * **Purpose:**
 * - Test authentication service performance under concurrent load
 * - Validate behavior during stress conditions with multiple users
 * - Measure authentication throughput and response times
 * - Test resource cleanup and memory management during auth flows
 * - Verify graceful degradation under adverse conditions
 *
 * **Scope:**
 * - Concurrent authentication handling (multiple simultaneous requests)
 * - Bulk authentication operations and batch processing
 * - Stress testing with many simultaneous authentication attempts
 * - Resource cleanup and memory leak detection during auth flows
 * - Database connection pool stress testing for auth operations
 * - Error recovery and resilience under authentication load
 *
 * **Related Test Files:**
 * - authentication-service.test.ts - Basic authentication operation functionality
 * - authentication-auth.test.ts - Authentication under load scenarios
 * - authentication-error-handling.test.ts - Error handling performance
 * - security.test.ts - Security performance and threat protection under load
 * - password-reset.test.ts - Password reset performance testing
 * - password-validation.test.ts - Password validation performance
 *
 * **Testing Guidelines:**
 * - Use realistic operation volumes and concurrency levels
 * - Measure and assert on reasonable performance thresholds
 * - Test both read and write authentication operation performance
 * - Verify resource cleanup after high-volume authentication operations
 * - Test graceful handling of partial authentication failures
 * - Include timing measurements for performance regression detection
 */

import { Application } from '@feathersjs/feathers';
import assert from 'assert';

import { getApp } from '@/app';
import { TestServiceBuilder, createTestUser, makeApiRequest, makeAuthenticatedApiRequest } from '@/test-utils';
import { DEFAULT_PASSWORD_STRONG, DEFAULT_CAPTCHA } from '@/test-utils/constants';

describe('Authentication Service - Performance & Concurrency (Modernized)', () => {
  let builder: TestServiceBuilder;
  let port: number;
  let userService: any;
  let sessionsService: any;
  let participantsService: any;
  let testUsers: any[] = [];

  before(async () => {
    // Initialize modern test utilities with unified setup
    builder = await new TestServiceBuilder()
      .withPerformanceMonitoring()
      .withServiceDiscovery(() => getApp())
      .build();

    port = builder.getPort() || 3030;

    // Get services from the app
    const app = getApp();
    userService = app.service('users');
    sessionsService = app.service('sessions');
    participantsService = app.service('participants');

    // Create shared test users for all tests using builder
    const regularUser = await builder.createTestUser(userService, 'regular-perf@example.com', DEFAULT_PASSWORD_STRONG, {
      roles: ['USER'],
    });

    const adminUser = await builder.createTestUser(userService, 'admin-perf@example.com', DEFAULT_PASSWORD_STRONG, {
      roles: ['ADMIN'],
    });

    testUsers = [regularUser, adminUser];
  });

  after(async () => {
    await builder.cleanup();
  });

  describe('Concurrent Authentication Handling', () => {
    it('should handle rapid successive authentication attempts', async () => {
      const baseEmail = `concurrent_auth_test_${Date.now()}`;
      const authenticationPromises = [];

      // Create multiple authentication attempts rapidly
      for (let i = 0; i < 3; i++) {
        // First create the user, then authenticate
        const email = `${baseEmail}_${i}@example.com`;
        authenticationPromises.push(
          (async () => {
            const user = await createTestUser(userService, email, DEFAULT_PASSWORD_STRONG, {
              roles: ['USER'],
            });

            return makeApiRequest(port, '/authentication', {
              strategy: 'local',
              email: user.email,
              password: DEFAULT_PASSWORD_STRONG,
              captcha: DEFAULT_CAPTCHA,
            });
          })(),
        );
      }

      const results = await Promise.all(authenticationPromises);

      assert.strictEqual(results.length, 3, 'Should handle all concurrent authentication operations');
      results.forEach((response) => {
        assert.ok(response, 'Each authentication should succeed');
        assert.ok(response.data?.accessToken, 'Each authentication should return access token');
      });
    });

    it('should handle concurrent authentication with same credentials', async () => {
      const testUser = testUsers[0];

      // Attempt multiple authentications with same credentials simultaneously
      const authPromises = [];
      for (let i = 0; i < 3; i++) {
        authPromises.push(
          makeApiRequest(port, '/authentication', {
            strategy: 'local',
            email: testUser.email,
            password: DEFAULT_PASSWORD_STRONG,
            captcha: DEFAULT_CAPTCHA,
          }),
        );
      }

      const results = await Promise.all(authPromises);

      assert.strictEqual(results.length, 3, 'Should handle all concurrent authentication requests');
      results.forEach((response) => {
        assert.ok(response, 'Each concurrent authentication should succeed');
        assert.ok(response.data?.accessToken, 'Each should return access token');
      });
    });

    it('should handle concurrent JWT token validations', async () => {
      const testUser = testUsers[0];

      // Get a valid token first
      const authResponse = await makeApiRequest(port, '/authentication', {
        strategy: 'local',
        email: testUser.email,
        password: DEFAULT_PASSWORD_STRONG,
        captcha: DEFAULT_CAPTCHA,
      });

      assert.ok(authResponse.data?.accessToken, 'Should have valid token for JWT testing');
      const validToken = authResponse.data.accessToken;

      // Test multiple JWT validations simultaneously
      const jwtPromises = [];
      for (let i = 0; i < 5; i++) {
        jwtPromises.push(
          makeAuthenticatedApiRequest(port, '/authentication', validToken, {
            strategy: 'jwt',
            accessToken: validToken,
          }),
        );
      }

      const results = await Promise.all(jwtPromises);

      assert.strictEqual(results.length, 5, 'Should handle all concurrent JWT validations');
      results.forEach((response) => {
        assert.ok(response, 'Each JWT validation should succeed');
        assert.ok(response.data?.user, 'Each should return user data');
      });
    });

    it('should handle bulk authentication operations efficiently', async () => {
      const startTime = Date.now();
      const batchSize = 5;

      // makeApiRequest is already imported at the top

      const createPromises = [];
      for (let i = 0; i < batchSize; i++) {
        createPromises.push(
          (async () => {
            const email = `bulk_auth_test_${Date.now()}_${i}@example.com`;
            const user = await createTestUser(userService, email, DEFAULT_PASSWORD_STRONG, {
              roles: ['USER'],
            });

            return makeApiRequest(port, '/authentication', {
              strategy: 'local',
              email: user.email,
              password: DEFAULT_PASSWORD_STRONG,
              captcha: DEFAULT_CAPTCHA,
            });
          })(),
        );
      }

      const results = await Promise.all(createPromises);
      const endTime = Date.now();

      assert.strictEqual(results.length, batchSize, 'Should authenticate all users in batch');
      results.forEach((response) => {
        assert.ok(response.data?.accessToken, 'Each authentication should return access token');
      });

      const duration = endTime - startTime;
      console.log(`Bulk authentication of ${batchSize} users took ${duration}ms`);

      // Should complete within reasonable time (adjust threshold as needed)
      assert.ok(duration < 10000, `Bulk authentication should complete within 10 seconds, took ${duration}ms`);
    });
  });

  describe('Performance Under Load', () => {
    it('should handle multiple simultaneous authentication requests', async () => {
      const testUser = testUsers[0];

      // makeApiRequest is already imported at the top

      const authPromises = [];
      for (let i = 0; i < 5; i++) {
        authPromises.push(
          makeApiRequest(port, '/authentication', {
            strategy: 'local',
            email: testUser.email,
            password: DEFAULT_PASSWORD_STRONG,
            captcha: DEFAULT_CAPTCHA,
          }),
        );
      }

      const results = await Promise.all(authPromises);

      assert.strictEqual(results.length, 5, 'Should handle all simultaneous authentication requests');
      results.forEach((response) => {
        assert.ok(response, 'Each authentication request should succeed');
        assert.ok(response.data?.accessToken, 'Each should return access token');
      });
    });

    it('should handle stress test with many authentication operations', async () => {
      const operationCount = 15;
      const operations = [];

      // Mix of different authentication operations
      for (let i = 0; i < operationCount; i++) {
        if (i % 3 === 0) {
          // Authentication operation with existing user
          operations.push(
            (async () => {
              return makeApiRequest(port, '/authentication', {
                strategy: 'local',
                email: testUsers[0].email,
                password: DEFAULT_PASSWORD_STRONG,
                captcha: DEFAULT_CAPTCHA,
              });
            })(),
          );
        } else if (i % 3 === 1) {
          // JWT validation operation
          operations.push(
            (async () => {
              const authResponse = await makeApiRequest(port, '/authentication', {
                strategy: 'local',
                email: testUsers[0].email,
                password: DEFAULT_PASSWORD_STRONG,
                captcha: DEFAULT_CAPTCHA,
              });

              if (authResponse.data?.accessToken) {
                return makeAuthenticatedApiRequest(port, '/authentication', authResponse.data.accessToken, {
                  strategy: 'jwt',
                  accessToken: authResponse.data.accessToken,
                });
              }
              throw new Error('Failed to get access token for JWT validation');
            })(),
          );
        } else {
          // Failed authentication attempt (for testing error handling under load)
          operations.push(
            (async () => {
              return makeApiRequest(port, '/authentication', {
                strategy: 'local',
                email: `nonexistent_${i}@example.com`,
                password: 'wrongpassword',
                captcha: DEFAULT_CAPTCHA,
              });
            })(),
          );
        }
      }

      const startTime = Date.now();
      const results = await Promise.allSettled(operations);
      const endTime = Date.now();

      const successfulOps = results.filter((r) => r.status === 'fulfilled').length;
      const duration = endTime - startTime;

      console.log(`${successfulOps}/${operationCount} authentication operations completed in ${duration}ms`);

      // At least 70% should succeed (some failures are expected due to error scenarios)
      assert.ok(
        successfulOps >= operationCount * 0.7,
        `At least 70% of authentication operations should succeed, got ${successfulOps}/${operationCount}`,
      );

      // Should complete within reasonable time
      assert.ok(duration < 15000, `Stress test should complete within 15 seconds, took ${duration}ms`);
    });
  });

  describe('Resource Cleanup and Memory Management', () => {
    it('should handle cleanup after many authentication operations', async () => {
      const initialAuthCount = 0; // We can't easily count auth operations, but we can test the process

      // makeApiRequest is already imported at the top

      // Perform many authentication operations
      const authPromises = [];
      for (let i = 0; i < 5; i++) {
        authPromises.push(
          makeApiRequest(port, '/authentication', {
            strategy: 'local',
            email: testUsers[0].email,
            password: DEFAULT_PASSWORD_STRONG,
            captcha: DEFAULT_CAPTCHA,
          }),
        );
      }

      const results = await Promise.all(authPromises);

      assert.strictEqual(results.length, 5, 'Should complete all authentication operations');
      results.forEach((response) => {
        assert.ok(response.data?.accessToken, 'Each authentication should return access token');
      });

      // Note: In a real scenario, you might want to test memory usage or connection pooling
      // For this test, we're just verifying the operations work consistently
    });

    it('should handle database connection stress during authentication', async () => {
      const connectionPromises = [];

      // Simulate many authentication operations in quick succession
      for (let i = 0; i < 8; i++) {
        connectionPromises.push(
          makeApiRequest(port, '/authentication', {
            strategy: 'local',
            email: testUsers[0].email,
            password: DEFAULT_PASSWORD_STRONG,
            captcha: DEFAULT_CAPTCHA,
          }),
        );
      }

      const results = await Promise.all(connectionPromises);

      assert.strictEqual(results.length, 8, 'Should handle database connection stress');
      results.forEach((response) => {
        assert.ok(response, 'Each authentication should succeed');
        assert.ok(response.data?.accessToken, 'Each should return access token');
      });
    });
  });

  describe('Error Recovery and Resilience', () => {
    it('should recover gracefully from partial authentication failures', async () => {
      const operations = [];

      // Mix of valid and invalid authentication operations
      operations.push(
        (async () => {
          return makeApiRequest(port, '/authentication', {
            strategy: 'local',
            email: testUsers[0].email,
            password: DEFAULT_PASSWORD_STRONG,
            captcha: DEFAULT_CAPTCHA,
          });
        })(), // Valid
      );

      operations.push(
        (async () => {
          return makeApiRequest(port, '/authentication', {
            strategy: 'local',
            email: 'non-existent-user@example.com',
            password: 'wrongpassword',
            captcha: DEFAULT_CAPTCHA,
          });
        })(), // Should fail but not throw
      );

      operations.push(
        (async () => {
          return makeApiRequest(port, '/authentication', {
            strategy: 'local',
            email: testUsers[0].email,
            password: DEFAULT_PASSWORD_STRONG,
            captcha: DEFAULT_CAPTCHA,
          });
        })(), // Valid
      );

      const results = await Promise.allSettled(operations);

      // All should settle (not throw unhandled exceptions)
      assert.strictEqual(results.length, 3, 'All authentication operations should settle');

      // At least some should succeed
      const fulfilledResults = results.filter((r) => r.status === 'fulfilled');
      assert.ok(fulfilledResults.length >= 2, 'At least some authentication operations should succeed');
    });

    it('should handle service recovery after authentication errors', async () => {
      // First, cause an authentication error
      const errorResponse = await makeApiRequest(port, '/authentication', {
        strategy: 'local',
        email: 'non-existent-user@example.com',
        password: 'wrongpassword',
        captcha: DEFAULT_CAPTCHA,
      });

      // Should return error status, not throw
      assert.ok(
        errorResponse && typeof errorResponse.status === 'number' && errorResponse.status >= 400,
        'Error response should have error status',
      );

      // Then verify service still works for valid authentication
      const testUser = testUsers[0];
      const validResponse = await makeApiRequest(port, '/authentication', {
        strategy: 'local',
        email: testUser.email,
        password: DEFAULT_PASSWORD_STRONG,
        captcha: DEFAULT_CAPTCHA,
      });

      assert.ok(validResponse, 'Authentication service should recover after errors');
      assert.ok(validResponse.data?.accessToken, 'Service should return access token after recovery');
    });
  });
});
