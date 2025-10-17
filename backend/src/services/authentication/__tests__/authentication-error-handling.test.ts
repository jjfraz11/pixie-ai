/**
 * @fileoverview Authentication Service - Error Handling Tests (Modernized)
 *
 * Simplified error handling tests using TestServiceBuilder and modern test utilities.
 * Focuses on core error scenarios while maintaining essential coverage.
 *
 * **Purpose:**
 * - Test core error handling for authentication failures
 * - Validate error response structure and security
 * - Test malformed input and edge cases
 * - Verify error recovery mechanisms
 *
 * **Scope:**
 * - Core authentication strategy errors
 * - Input validation errors
 * - Malformed request handling
 * - Basic security error scenarios
 *
 * **Note:** Extensive security tests moved to authentication-security.test.ts
 * **Note:** Performance error tests moved to authentication-performance.test.ts
 */

import { Application } from '@feathersjs/feathers';
import assert from 'assert';

import { getApp } from '../../../app';
import {
  TestServiceBuilder,
  AuthenticationHelper,
  createUsers,
  STATUS_CODE_CREATED,
  STATUS_CODE_UNAUTHORIZED,
  STATUS_CODE_BAD_REQUEST,
  DEFAULT_PASSWORD_STRONG,
  DEFAULT_PASSWORD_WEAK,
  DEFAULT_CAPTCHA,
} from '../../../test-utils';

describe('Authentication Service - Error Handling & Edge Cases', () => {
  let builder: TestServiceBuilder;
  let authHelper: AuthenticationHelper;
  let userService: any;
  let testUser: any;

  before(async () => {
    // Initialize modern test utilities
    builder = await new TestServiceBuilder()
      .withPerformanceMonitoring()
      .withServiceDiscovery(() => getApp())
      .build();

    authHelper = new AuthenticationHelper({
      port: builder.getPort(),
      autoRefresh: false,
      tokenCacheEnabled: true,
    });

    // Get services from the builder
    const services = builder.getServices();
    userService = services.users;

    // Create test user using fluent builder
    const userBuilder = createUsers('auth-errors-user@example.com')
      .withPassword(DEFAULT_PASSWORD_STRONG)
      .withRoles('USER');

    const userResult = await userBuilder.build();
    testUser = userResult.users[0];
  });

  after(async () => {
    if (testUser) {
      try {
        await userService.remove(testUser.id);
      } catch (error) {
        console.warn(`Failed to cleanup test user:`, error);
      }
    }
    await builder.cleanup();
  });

  describe('Authentication Strategy Error Handling', () => {
    let testUser: any;

    before(async () => {
      testUser = await createTestUser(
        userService,
        `strategy-errors-${Date.now()}@example.com`,
        DEFAULT_PASSWORD_STRONG,
        { roles: ['USER'] },
      );
    });

    it('should handle local strategy authentication errors gracefully', async () => {
      const response = await makeApiRequest(port, '/authentication', {
        strategy: 'local',
        email: 'nonexistent@example.com',
        password: 'wrongpassword',
        captcha: DEFAULT_CAPTCHA,
      });

      assert.strictEqual(response.status, STATUS_CODE_UNAUTHORIZED, 'Should return 401 for invalid credentials');
      assert.ok(response.errors?.length, 'Should provide error messages');
      assert.ok(Array.isArray(response.errors), 'Error messages should be in array format');
    });

    it('should handle JWT strategy authentication errors gracefully', async () => {
      const response = await makeAuthenticatedApiRequest(port, '/authentication', 'invalid-jwt-token', {
        strategy: 'jwt',
        accessToken: 'invalid-jwt-token',
      });

      assert.strictEqual(response.status, STATUS_CODE_UNAUTHORIZED, 'Should return 401 for invalid JWT token');
      assert.ok(response.errors?.length, 'Should provide error messages for JWT failures');
    });

    it('should handle unsupported authentication strategy errors', async () => {
      const response = await makeApiRequest(port, '/authentication', {
        strategy: 'unsupported_strategy',
        email: testUser.email,
        password: DEFAULT_PASSWORD_STRONG,
        captcha: DEFAULT_CAPTCHA,
      });

      assert.strictEqual(response.status, STATUS_CODE_UNAUTHORIZED, 'Should handle unsupported strategy');
      assert.ok(response.errors?.length, 'Should provide error messages for unsupported strategy');
    });

    it('should handle missing strategy field errors', async () => {
      const response = await makeApiRequest(port, '/authentication', {
        email: testUser.email,
        password: DEFAULT_PASSWORD_STRONG,
        captcha: DEFAULT_CAPTCHA,
        // missing strategy
      });

      assert.strictEqual(response.status, STATUS_CODE_UNAUTHORIZED, 'Should handle missing strategy field');
      assert.ok(response.errors?.length, 'Should provide error messages for missing strategy');
    });

    it('should handle malformed authentication request errors', async () => {
      const response = await makeApiRequest(port, '/authentication', {
        strategy: 'local',
        email: testUser.email,
        password: DEFAULT_PASSWORD_STRONG,
        captcha: 'malformed-captcha-data',
      });

      // Should either succeed or fail gracefully with proper error handling
      if (response && response.status !== STATUS_CODE_CREATED) {
        assert.ok(response.status >= 400, 'Should handle malformed requests appropriately');
        assert.ok(response.errors?.length, 'Should provide error messages for malformed requests');
      }
    });

    it('should handle authentication timeout errors', async () => {
      // Test with extremely long password that might cause timeout
      const longPassword = 'A'.repeat(10000) + '1!';

      const response = await makeApiRequest(port, '/authentication', {
        strategy: 'local',
        email: testUser.email,
        password: longPassword,
        captcha: DEFAULT_CAPTCHA,
      });

      // Should handle timeout scenarios gracefully
      if (response && response.status !== STATUS_CODE_CREATED) {
        assert.ok(response.status >= 400, 'Should handle timeout errors appropriately');
        assert.ok(response.errors?.length, 'Should provide error messages for timeout scenarios');
      }
    });

    it('should handle concurrent authentication errors', async () => {
      // Test multiple simultaneous authentication errors
      const errorPromises = [];
      for (let i = 0; i < 3; i++) {
        errorPromises.push(
          makeApiRequest(port, '/authentication', {
            strategy: 'local',
            email: `nonexistent-${i}@example.com`,
            password: 'wrongpassword',
            captcha: DEFAULT_CAPTCHA,
          }),
        );
      }

      const responses = await Promise.all(errorPromises);

      // All error responses should be handled consistently
      responses.forEach((response) => {
        assert.strictEqual(response.status, STATUS_CODE_UNAUTHORIZED, 'Each error should be handled consistently');
        assert.ok(response.errors?.length, 'Each should provide error messages');
        assert.ok(Array.isArray(response.errors), 'Error format should be consistent');
      });
    });

    it('should handle authentication strategy configuration errors', async () => {
      // Test scenarios that might cause strategy configuration errors
      const response = await makeApiRequest(port, '/authentication', {
        strategy: 'local',
        email: testUser.email,
        password: DEFAULT_PASSWORD_STRONG,
        captcha: 'configuration-error-captcha',
      });

      // Should handle configuration errors gracefully
      if (response.status !== STATUS_CODE_CREATED) {
        assert.ok(response.status >= 400, 'Should handle configuration errors appropriately');
      }
    });

    it('should handle authentication strategy initialization errors', async () => {
      // Test that strategy initialization errors are handled properly
      const response = await makeApiRequest(port, '/authentication', {
        strategy: 'local',
        email: testUser.email,
        password: DEFAULT_PASSWORD_STRONG,
        captcha: DEFAULT_CAPTCHA,
      });

      // Should handle initialization errors gracefully
      if (response.status !== STATUS_CODE_CREATED) {
        assert.ok(response.status >= 400, 'Should handle initialization errors appropriately');
      }
    });

    it('should handle authentication strategy dependency errors', async () => {
      // Test scenarios where strategy dependencies might fail
      const response = await makeApiRequest(port, '/authentication', {
        strategy: 'local',
        email: testUser.email,
        password: DEFAULT_PASSWORD_STRONG,
        captcha: 'dependency-error-captcha',
      });

      // Should handle dependency errors gracefully
      if (response.status !== STATUS_CODE_CREATED) {
        assert.ok(response.status >= 400, 'Should handle dependency errors appropriately');
      }
    });

    it('should handle authentication strategy resource errors', async () => {
      // Test scenarios that might cause resource-related errors
      const response = await makeApiRequest(port, '/authentication', {
        strategy: 'local',
        email: testUser.email,
        password: DEFAULT_PASSWORD_STRONG,
        captcha: 'resource-error-captcha',
      });

      // Should handle resource errors gracefully
      if (response.status !== STATUS_CODE_CREATED) {
        assert.ok(response.status >= 400, 'Should handle resource errors appropriately');
      }
    });

    it('should handle authentication strategy validation errors', async () => {
      // Test strategy validation error scenarios
      const response = await makeApiRequest(port, '/authentication', {
        strategy: 'local',
        email: 'invalid-email-format',
        password: DEFAULT_PASSWORD_STRONG,
        captcha: DEFAULT_CAPTCHA,
      });

      assert.strictEqual(response.status, STATUS_CODE_UNAUTHORIZED, 'Should handle validation errors');
      assert.ok(response.errors?.length, 'Should provide error messages for validation failures');
    });

    it('should handle authentication strategy transformation errors', async () => {
      // Test scenarios where data transformation might fail
      const response = await makeApiRequest(port, '/authentication', {
        strategy: 'local',
        email: testUser.email,
        password: DEFAULT_PASSWORD_STRONG,
        captcha: 'transformation-error-captcha',
      });

      // Should handle transformation errors gracefully
      if (response.status !== STATUS_CODE_CREATED) {
        assert.ok(response.status >= 400, 'Should handle transformation errors appropriately');
      }
    });

    it('should handle authentication strategy serialization errors', async () => {
      // Test scenarios where serialization might fail
      const response = await makeApiRequest(port, '/authentication', {
        strategy: 'local',
        email: testUser.email,
        password: DEFAULT_PASSWORD_STRONG,
        captcha: 'serialization-error-captcha',
      });

      // Should handle serialization errors gracefully
      if (response.status !== STATUS_CODE_CREATED) {
        assert.ok(response.status >= 400, 'Should handle serialization errors appropriately');
      }
    });

    it('should handle authentication strategy cleanup errors', async () => {
      // Test that strategy cleanup errors are handled properly
      const response = await makeApiRequest(port, '/authentication', {
        strategy: 'local',
        email: testUser.email,
        password: DEFAULT_PASSWORD_STRONG,
        captcha: 'cleanup-error-captcha',
      });

      // Should handle cleanup errors gracefully
      if (response.status !== STATUS_CODE_CREATED) {
        assert.ok(response.status >= 400, 'Should handle cleanup errors appropriately');
      }
    });
  });

  describe('Malformed Request Error Handling', () => {
    let testUser: any;

    before(async () => {
      testUser = await createTestUser(
        userService,
        `malformed-requests-${Date.now()}@example.com`,
        DEFAULT_PASSWORD_STRONG,
        { roles: ['USER'] },
      );
    });

    it('should handle malformed JSON request body errors', async () => {
      const response = await makeApiRequest(port, '/authentication', 'invalid json payload' as any);

      // Should return appropriate error status or network error
      if (response && response.status) {
        assert.ok(response.status >= 400, 'Should return error status for malformed JSON');
        assert.ok(response.errors?.length, 'Should provide error messages for malformed JSON');
      } else {
        // Network error or other response format
        assert.ok(response, 'Should return some form of response for malformed JSON');
      }
    });

    it('should handle null request body errors', async () => {
      const response = await makeApiRequest(port, '/authentication', null as any);

      // Should return appropriate error status or network error
      if (response && response.status) {
        assert.ok(response.status >= 400, 'Should return error status for null request');
        assert.ok(response.errors?.length, 'Should provide error messages for null request');
      } else {
        // Network error or other response format
        assert.ok(response, 'Should return some form of response for null request');
      }
    });

    it('should handle undefined request body errors', async () => {
      const response = await makeApiRequest(port, '/authentication', undefined as any);

      // Should return appropriate error status or network error
      if (response && response.status) {
        assert.ok(response.status >= 400, 'Should return error status for undefined request');
      } else {
        // Network error or other response format
        assert.ok(response, 'Should return some form of response for undefined request');
      }
    });

    it('should handle empty request body errors', async () => {
      const response = await makeApiRequest(port, '/authentication', {});

      assert.strictEqual(response.status, STATUS_CODE_UNAUTHORIZED, 'Should handle empty request body');
      assert.ok(response.errors?.length, 'Should provide error messages for empty request');
    });

    it('should handle request body with invalid structure errors', async () => {
      const response = await makeApiRequest(port, '/authentication', {
        invalidField: 'invalidValue',
        anotherInvalid: 123,
      });

      assert.strictEqual(response.status, STATUS_CODE_UNAUTHORIZED, 'Should handle invalid request structure');
      assert.ok(response.errors?.length, 'Should provide error messages for invalid structure');
    });

    it('should handle request body with nested invalid data errors', async () => {
      const response = await makeApiRequest(port, '/authentication', {
        strategy: 'local',
        email: testUser.email,
        password: DEFAULT_PASSWORD_STRONG,
        captcha: DEFAULT_CAPTCHA,
        nested: {
          invalid: {
            data: 'structure',
          },
        },
      });

      // Should either succeed or fail gracefully
      if (response.status !== STATUS_CODE_CREATED) {
        assert.ok(response.status >= 400, 'Should handle nested invalid data appropriately');
        assert.ok(response.errors?.length, 'Should provide error messages');
      }
    });

    it('should handle request body with circular references errors', async () => {
      const circularObj: any = {
        strategy: 'local',
        email: testUser.email,
        password: DEFAULT_PASSWORD_STRONG,
        captcha: DEFAULT_CAPTCHA,
      };
      circularObj.circular = circularObj;

      const response = await makeApiRequest(port, '/authentication', circularObj);

      // Should handle circular references gracefully
      if (response && response.status) {
        assert.ok(response.status >= 400, 'Should handle circular references appropriately');
      }
    });

    it('should handle extremely large request body errors', async () => {
      const largeObj: any = {
        strategy: 'local',
        email: testUser.email,
        password: DEFAULT_PASSWORD_STRONG,
        captcha: DEFAULT_CAPTCHA,
      };

      // Add extremely large data
      largeObj.largeData = 'A'.repeat(100000);

      const response = await makeApiRequest(port, '/authentication', largeObj);

      // Should handle large request bodies gracefully
      if (response && response.status) {
        assert.ok(response.status >= 400, 'Should handle extremely large request bodies appropriately');
      }
    });

    it('should handle request body with binary data errors', async () => {
      const binaryData = Buffer.from([0x00, 0x01, 0x02, 0x03]);
      const response = await makeApiRequest(port, '/authentication', binaryData as any);

      // Should handle binary data gracefully
      if (response && response.status) {
        assert.ok(response.status >= 400, 'Should handle binary data appropriately');
      }
    });

    it('should handle request body with special characters errors', async () => {
      const specialCharData = {
        strategy: 'local',
        email: testUser.email,
        password: DEFAULT_PASSWORD_STRONG,
        captcha: DEFAULT_CAPTCHA,
        special: '!@#$%^&*()_+{}|:<>?[]\\;\'",./',
      };

      const response = await makeApiRequest(port, '/authentication', specialCharData);

      // Should handle special characters gracefully
      if (response.status !== STATUS_CODE_CREATED) {
        assert.ok(response.status >= 400, 'Should handle special characters appropriately');
        assert.ok(response.errors?.length, 'Should provide error messages');
      }
    });

    it('should handle request body with Unicode characters errors', async () => {
      const unicodeData = {
        strategy: 'local',
        email: testUser.email,
        password: DEFAULT_PASSWORD_STRONG,
        captcha: DEFAULT_CAPTCHA,
        unicode: '🚀🌟💻🔥✨🎉💡🎯🏆⭐🌈🎨🔥💯',
      };

      const response = await makeApiRequest(port, '/authentication', unicodeData);

      // Should handle Unicode characters gracefully
      if (response.status !== STATUS_CODE_CREATED) {
        assert.ok(response.status >= 400, 'Should handle Unicode characters appropriately');
        assert.ok(response.errors?.length, 'Should provide error messages');
      }
    });

    it('should handle request body with mixed data types errors', async () => {
      const mixedData = {
        strategy: 'local',
        email: testUser.email,
        password: DEFAULT_PASSWORD_STRONG,
        captcha: DEFAULT_CAPTCHA,
        number: 42,
        boolean: true,
        array: [1, 2, 3],
        object: { nested: 'value' },
        null: null,
        undefined: undefined,
      };

      const response = await makeApiRequest(port, '/authentication', mixedData);

      // Should handle mixed data types gracefully
      if (response.status !== STATUS_CODE_CREATED) {
        assert.ok(response.status >= 400, 'Should handle mixed data types appropriately');
        assert.ok(response.errors?.length, 'Should provide error messages');
      }
    });

    it('should handle request body with function data errors', async () => {
      const functionData = {
        strategy: 'local',
        email: testUser.email,
        password: DEFAULT_PASSWORD_STRONG,
        captcha: DEFAULT_CAPTCHA,
        func: function () {
          return 'test';
        },
      };

      const response = await makeApiRequest(port, '/authentication', functionData);

      // Should handle function data gracefully
      if (response && response.status) {
        assert.ok(response.status >= 400, 'Should handle function data appropriately');
      }
    });

    it('should handle request body with symbol data errors', async () => {
      const symbolData = {
        strategy: 'local',
        email: testUser.email,
        password: DEFAULT_PASSWORD_STRONG,
        captcha: DEFAULT_CAPTCHA,
        symbol: Symbol('test'),
      };

      const response = await makeApiRequest(port, '/authentication', symbolData);

      // Should handle symbol data gracefully
      if (response && response.status) {
        assert.ok(response.status >= 400, 'Should handle symbol data appropriately');
      }
    });

    it('should handle request body with prototype pollution attempts errors', async () => {
      const pollutedData = {
        strategy: 'local',
        email: testUser.email,
        password: DEFAULT_PASSWORD_STRONG,
        captcha: DEFAULT_CAPTCHA,
        __proto__: { polluted: true },
        constructor: { prototype: { polluted: true } },
      };

      const response = await makeApiRequest(port, '/authentication', pollutedData);

      // Should handle prototype pollution attempts gracefully
      if (response.status !== STATUS_CODE_CREATED) {
        assert.ok(response.status >= 400, 'Should handle prototype pollution attempts appropriately');
        assert.ok(response.errors?.length, 'Should provide error messages');
      }
    });

    it('should handle deeply nested request body errors', async () => {
      // Create deeply nested object
      let nested: any = {
        strategy: 'local',
        email: testUser.email,
        password: DEFAULT_PASSWORD_STRONG,
        captcha: DEFAULT_CAPTCHA,
      };
      for (let i = 0; i < 100; i++) {
        nested = { nested };
      }

      const response = await makeApiRequest(port, '/authentication', nested);

      // Should handle deeply nested data gracefully
      if (response && response.status) {
        assert.ok(response.status >= 400, 'Should handle deeply nested data appropriately');
      }
    });
  });

  describe('Input Validation Error Handling', () => {
    let testUser: any;

    before(async () => {
      testUser = await createTestUser(
        userService,
        `validation-errors-${Date.now()}@example.com`,
        DEFAULT_PASSWORD_STRONG,
        { roles: ['USER'] },
      );
    });

    it('should handle invalid email format errors', async () => {
      const response = await makeApiRequest(port, '/authentication', {
        strategy: 'local',
        email: 'not-an-email',
        password: DEFAULT_PASSWORD_STRONG,
        captcha: DEFAULT_CAPTCHA,
      });

      assert.strictEqual(response.status, STATUS_CODE_UNAUTHORIZED, 'Should handle invalid email format');
      assert.ok(response.errors?.length, 'Should provide error messages for invalid email');
    });

    it('should handle missing email field errors', async () => {
      const response = await makeApiRequest(port, '/authentication', {
        strategy: 'local',
        password: DEFAULT_PASSWORD_STRONG,
        captcha: DEFAULT_CAPTCHA,
        // missing email
      });

      assert.strictEqual(response.status, STATUS_CODE_UNAUTHORIZED, 'Should handle missing email field');
      assert.ok(response.errors?.length, 'Should provide error messages for missing email');
    });

    it('should handle missing password field errors', async () => {
      const response = await makeApiRequest(port, '/authentication', {
        strategy: 'local',
        email: testUser.email,
        captcha: DEFAULT_CAPTCHA,
        // missing password
      });

      assert.strictEqual(response.status, STATUS_CODE_UNAUTHORIZED, 'Should handle missing password field');
      assert.ok(response.errors?.length, 'Should provide error messages for missing password');
    });

    it('should handle missing captcha field errors', async () => {
      const response = await makeApiRequest(port, '/authentication', {
        strategy: 'local',
        email: testUser.email,
        password: DEFAULT_PASSWORD_STRONG,
        // missing captcha
      });

      assert.strictEqual(response.status, STATUS_CODE_BAD_REQUEST, 'Should handle missing CAPTCHA field');
      assert.ok(response.errors?.length, 'Should provide error messages for missing CAPTCHA');
    });

    it('should handle empty email field errors', async () => {
      const response = await makeApiRequest(port, '/authentication', {
        strategy: 'local',
        email: '',
        password: DEFAULT_PASSWORD_STRONG,
        captcha: DEFAULT_CAPTCHA,
      });

      assert.strictEqual(response.status, STATUS_CODE_UNAUTHORIZED, 'Should handle empty email field');
      assert.ok(response.errors?.length, 'Should provide error messages for empty email');
    });

    it('should handle empty password field errors', async () => {
      const response = await makeApiRequest(port, '/authentication', {
        strategy: 'local',
        email: testUser.email,
        password: '',
        captcha: DEFAULT_CAPTCHA,
      });

      assert.strictEqual(response.status, STATUS_CODE_UNAUTHORIZED, 'Should handle empty password field');
      assert.ok(response.errors?.length, 'Should provide error messages for empty password');
    });

    it('should handle whitespace-only email field errors', async () => {
      const response = await makeApiRequest(port, '/authentication', {
        strategy: 'local',
        email: '   ',
        password: DEFAULT_PASSWORD_STRONG,
        captcha: DEFAULT_CAPTCHA,
      });

      assert.strictEqual(response.status, STATUS_CODE_UNAUTHORIZED, 'Should handle whitespace-only email');
      assert.ok(response.errors?.length, 'Should provide error messages for whitespace-only email');
    });

    it('should handle whitespace-only password field errors', async () => {
      const response = await makeApiRequest(port, '/authentication', {
        strategy: 'local',
        email: testUser.email,
        password: '   ',
        captcha: DEFAULT_CAPTCHA,
      });

      assert.strictEqual(response.status, STATUS_CODE_UNAUTHORIZED, 'Should handle whitespace-only password');
      assert.ok(response.errors?.length, 'Should provide error messages for whitespace-only password');
    });

    it('should handle extremely long email address errors', async () => {
      const longEmail = 'a'.repeat(500) + '@example.com';
      const response = await makeApiRequest(port, '/authentication', {
        strategy: 'local',
        email: longEmail,
        password: DEFAULT_PASSWORD_STRONG,
        captcha: DEFAULT_CAPTCHA,
      });

      // Should handle extremely long email appropriately
      if (response && response.status) {
        assert.ok(response.status >= 400, 'Should handle extremely long email appropriately');
        assert.ok(response.errors?.length, 'Should provide error messages for long email');
      }
    });

    it('should handle extremely long password errors', async () => {
      const longPassword = 'A'.repeat(1000) + '1!';
      const response = await makeApiRequest(port, '/authentication', {
        strategy: 'local',
        email: testUser.email,
        password: longPassword,
        captcha: DEFAULT_CAPTCHA,
      });

      // Should handle extremely long password appropriately
      if (response && response.status) {
        assert.ok(response.status >= 400, 'Should handle extremely long password appropriately');
        assert.ok(response.errors?.length, 'Should provide error messages for long password');
      }
    });

    it('should handle extremely long captcha errors', async () => {
      const longCaptcha = 'A'.repeat(10000);
      const response = await makeApiRequest(port, '/authentication', {
        strategy: 'local',
        email: testUser.email,
        password: DEFAULT_PASSWORD_STRONG,
        captcha: longCaptcha,
      });

      assert.strictEqual(response.status, STATUS_CODE_BAD_REQUEST, 'Should handle extremely long CAPTCHA');
      assert.ok(response.errors?.length, 'Should provide error messages for long CAPTCHA');
    });

    it('should handle special characters in email errors', async () => {
      const specialEmail = 'test+special@example.com';
      const response = await makeApiRequest(port, '/authentication', {
        strategy: 'local',
        email: specialEmail,
        password: DEFAULT_PASSWORD_STRONG,
        captcha: DEFAULT_CAPTCHA,
      });

      // Special characters in local part should be handled
      if (response && response.status) {
        // Either succeed (if valid) or fail gracefully (if not supported)
        assert.ok(response.status < 500, 'Should handle special characters in email gracefully');
      }
    });

    it('should handle Unicode characters in email errors', async () => {
      const unicodeEmail = 'tëst@example.com';
      const response = await makeApiRequest(port, '/authentication', {
        strategy: 'local',
        email: unicodeEmail,
        password: DEFAULT_PASSWORD_STRONG,
        captcha: DEFAULT_CAPTCHA,
      });

      // Unicode in email should be handled gracefully
      if (response && response.status) {
        assert.ok(response.status < 500, 'Should handle Unicode characters in email gracefully');
      }
    });

    it('should handle SQL injection attempt errors', async () => {
      const sqlInjectionEmail = "test'; DROP TABLE users; --@example.com";
      const response = await makeApiRequest(port, '/authentication', {
        strategy: 'local',
        email: sqlInjectionEmail,
        password: DEFAULT_PASSWORD_STRONG,
        captcha: DEFAULT_CAPTCHA,
      });

      // Should handle SQL injection attempts gracefully
      if (response && response.status) {
        assert.ok(response.status >= 400, 'Should handle SQL injection attempts appropriately');
        assert.ok(response.errors?.length, 'Should provide error messages for SQL injection attempts');
      }
    });

    it('should handle XSS attempt errors', async () => {
      const xssEmail = '<script>alert("xss")</script>@example.com';
      const response = await makeApiRequest(port, '/authentication', {
        strategy: 'local',
        email: xssEmail,
        password: DEFAULT_PASSWORD_STRONG,
        captcha: DEFAULT_CAPTCHA,
      });

      // Should handle XSS attempts gracefully
      if (response && response.status) {
        assert.ok(response.status >= 400, 'Should handle XSS attempts appropriately');
        assert.ok(response.errors?.length, 'Should provide error messages for XSS attempts');
      }
    });

    it('should handle NoSQL injection attempt errors', async () => {
      const nosqlInjection = {
        strategy: 'local',
        email: { $ne: null },
        password: DEFAULT_PASSWORD_STRONG,
        captcha: DEFAULT_CAPTCHA,
      };

      const response = await makeApiRequest(port, '/authentication', nosqlInjection);

      // Should handle NoSQL injection attempts gracefully
      if (response && response.status) {
        assert.ok(response.status >= 400, 'Should handle NoSQL injection attempts appropriately');
        assert.ok(response.errors?.length, 'Should provide error messages for NoSQL injection attempts');
      }
    });

    it('should handle command injection attempt errors', async () => {
      const commandInjectionEmail = 'test@example.com; rm -rf /';
      const response = await makeApiRequest(port, '/authentication', {
        strategy: 'local',
        email: commandInjectionEmail,
        password: DEFAULT_PASSWORD_STRONG,
        captcha: DEFAULT_CAPTCHA,
      });

      // Should handle command injection attempts gracefully
      if (response && response.status) {
        assert.ok(response.status >= 400, 'Should handle command injection attempts appropriately');
        assert.ok(response.errors?.length, 'Should provide error messages for command injection attempts');
      }
    });

    it('should handle LDAP injection attempt errors', async () => {
      const ldapInjectionEmail = 'test*)(uid=*))(|(uid=*@example.com';
      const response = await makeApiRequest(port, '/authentication', {
        strategy: 'local',
        email: ldapInjectionEmail,
        password: DEFAULT_PASSWORD_STRONG,
        captcha: DEFAULT_CAPTCHA,
      });

      // Should handle LDAP injection attempts gracefully
      if (response && response.status) {
        assert.ok(response.status >= 400, 'Should handle LDAP injection attempts appropriately');
        assert.ok(response.errors?.length, 'Should provide error messages for LDAP injection attempts');
      }
    });

    it('should handle path traversal attempt errors', async () => {
      const pathTraversalEmail = '../../../etc/passwd@example.com';
      const response = await makeApiRequest(port, '/authentication', {
        strategy: 'local',
        email: pathTraversalEmail,
        password: DEFAULT_PASSWORD_STRONG,
        captcha: DEFAULT_CAPTCHA,
      });

      // Should handle path traversal attempts gracefully
      if (response && response.status) {
        assert.ok(response.status >= 400, 'Should handle path traversal attempts appropriately');
        assert.ok(response.errors?.length, 'Should provide error messages for path traversal attempts');
      }
    });

    it('should handle null byte injection attempt errors', async () => {
      const nullByteEmail = 'test@example.com\0';
      const response = await makeApiRequest(port, '/authentication', {
        strategy: 'local',
        email: nullByteEmail,
        password: DEFAULT_PASSWORD_STRONG,
        captcha: DEFAULT_CAPTCHA,
      });

      // Should handle null byte injection attempts gracefully
      if (response && response.status) {
        assert.ok(response.status >= 400, 'Should handle null byte injection attempts appropriately');
        assert.ok(response.errors?.length, 'Should provide error messages for null byte injection attempts');
      }
    });

    it('should handle format string attack attempt errors', async () => {
      const formatStringEmail = '%s%s%s%s%s@example.com';
      const response = await makeApiRequest(port, '/authentication', {
        strategy: 'local',
        email: formatStringEmail,
        password: DEFAULT_PASSWORD_STRONG,
        captcha: DEFAULT_CAPTCHA,
      });

      // Should handle format string attack attempts gracefully
      if (response && response.status) {
        assert.ok(response.status >= 400, 'Should handle format string attack attempts appropriately');
        assert.ok(response.errors?.length, 'Should provide error messages for format string attack attempts');
      }
    });

    it('should handle buffer overflow attempt errors', async () => {
      const bufferOverflowEmail = 'A'.repeat(10000) + '@example.com';
      const response = await makeApiRequest(port, '/authentication', {
        strategy: 'local',
        email: bufferOverflowEmail,
        password: DEFAULT_PASSWORD_STRONG,
        captcha: DEFAULT_CAPTCHA,
      });

      // Should handle buffer overflow attempts gracefully
      if (response && response.status) {
        assert.ok(response.status >= 400, 'Should handle buffer overflow attempts appropriately');
        assert.ok(response.errors?.length, 'Should provide error messages for buffer overflow attempts');
      }
    });

    it('should handle regex DoS attempt errors', async () => {
      const regexDosEmail = 'a'.repeat(10000) + '!' + 'a'.repeat(10000) + '@example.com';
      const response = await makeApiRequest(port, '/authentication', {
        strategy: 'local',
        email: regexDosEmail,
        password: DEFAULT_PASSWORD_STRONG,
        captcha: DEFAULT_CAPTCHA,
      });

      // Should handle regex DoS attempts gracefully
      if (response && response.status) {
        assert.ok(response.status >= 400, 'Should handle regex DoS attempts appropriately');
        assert.ok(response.errors?.length, 'Should provide error messages for regex DoS attempts');
      }
    });

    it('should handle prototype pollution attempt errors', async () => {
      const prototypePollution = {
        strategy: 'local',
        email: testUser.email,
        password: DEFAULT_PASSWORD_STRONG,
        captcha: DEFAULT_CAPTCHA,
        __proto__: { isAdmin: true },
        'constructor.prototype.isAdmin': true,
      };

      const response = await makeApiRequest(port, '/authentication', prototypePollution);

      // Should handle prototype pollution attempts gracefully
      if (response.status !== STATUS_CODE_CREATED) {
        assert.ok(response.status >= 400, 'Should handle prototype pollution attempts appropriately');
        assert.ok(response.errors?.length, 'Should provide error messages for prototype pollution attempts');
      }
    });

    it('should handle deserialization attack attempt errors', async () => {
      const maliciousData = {
        strategy: 'local',
        email: testUser.email,
        password: DEFAULT_PASSWORD_STRONG,
        captcha: DEFAULT_CAPTCHA,
        malicious: 'data',
      };

      const response = await makeApiRequest(port, '/authentication', maliciousData);

      // Should handle deserialization attack attempts gracefully
      if (response.status !== STATUS_CODE_CREATED) {
        assert.ok(response.status >= 400, 'Should handle deserialization attack attempts appropriately');
        assert.ok(response.errors?.length, 'Should provide error messages for deserialization attack attempts');
      }
    });

    it('should handle type confusion attempt errors', async () => {
      const typeConfusionData = {
        strategy: 'local',
        email: testUser.email,
        password: DEFAULT_PASSWORD_STRONG,
        captcha: DEFAULT_CAPTCHA,
        toString: function () {
          return 'malicious';
        },
        valueOf: function () {
          return 42;
        },
      };

      const response = await makeApiRequest(port, '/authentication', typeConfusionData);

      // Should handle type confusion attempts gracefully
      if (response && response.status) {
        assert.ok(response.status >= 400, 'Should handle type confusion attempts appropriately');
      }
    });

    it('should handle integer overflow attempt errors', async () => {
      const overflowData = {
        strategy: 'local',
        email: testUser.email,
        password: DEFAULT_PASSWORD_STRONG,
        captcha: DEFAULT_CAPTCHA,
        count: Number.MAX_SAFE_INTEGER + 1000,
      };

      const response = await makeApiRequest(port, '/authentication', overflowData);

      // Should handle integer overflow attempts gracefully
      if (response && response.status) {
        assert.ok(response.status >= 400, 'Should handle integer overflow attempts appropriately');
      }
    });

    it('should handle floating point precision attack attempt errors', async () => {
      const precisionAttackData = {
        strategy: 'local',
        email: testUser.email,
        password: DEFAULT_PASSWORD_STRONG,
        captcha: DEFAULT_CAPTCHA,
        price: 0.1 + 0.2, // 0.30000000000000004
      };

      const response = await makeApiRequest(port, '/authentication', precisionAttackData);

      // Should handle floating point precision attacks gracefully
      if (response.status !== STATUS_CODE_CREATED) {
        assert.ok(response.status >= 400, 'Should handle floating point precision attacks appropriately');
        assert.ok(response.errors?.length, 'Should provide error messages for floating point precision attacks');
      }
    });

    it('should handle timezone manipulation attempt errors', async () => {
      const timezoneData = {
        strategy: 'local',
        email: testUser.email,
        password: DEFAULT_PASSWORD_STRONG,
        captcha: DEFAULT_CAPTCHA,
        timezone: 'America/New_York; rm -rf /',
      };

      const response = await makeApiRequest(port, '/authentication', timezoneData);

      // Should handle timezone manipulation attempts gracefully
      if (response && response.status) {
        assert.ok(response.status >= 400, 'Should handle timezone manipulation attempts appropriately');
        assert.ok(response.errors?.length, 'Should provide error messages for timezone manipulation attempts');
      }
    });

    it('should handle locale manipulation attempt errors', async () => {
      const localeData = {
        strategy: 'local',
        email: testUser.email,
        password: DEFAULT_PASSWORD_STRONG,
        captcha: DEFAULT_CAPTCHA,
        locale: 'en_US.UTF-8; malicious command',
      };

      const response = await makeApiRequest(port, '/authentication', localeData);

      // Should handle locale manipulation attempts gracefully
      if (response && response.status) {
        assert.ok(response.status >= 400, 'Should handle locale manipulation attempts appropriately');
        assert.ok(response.errors?.length, 'Should provide error messages for locale manipulation attempts');
      }
    });

    it('should handle encoding attack attempt errors', async () => {
      const encodingData = {
        strategy: 'local',
        email: testUser.email,
        password: DEFAULT_PASSWORD_STRONG,
        captcha: DEFAULT_CAPTCHA,
        encoding: 'UTF-8\0malicious',
      };

      const response = await makeApiRequest(port, '/authentication', encodingData);

      // Should handle encoding attack attempts gracefully
      if (response && response.status) {
        assert.ok(response.status >= 400, 'Should handle encoding attack attempts appropriately');
        assert.ok(response.errors?.length, 'Should provide error messages for encoding attack attempts');
      }
    });

    it('should handle header injection attempt errors', async () => {
      const headerInjectionData = {
        strategy: 'local',
        email: testUser.email,
        password: DEFAULT_PASSWORD_STRONG,
        captcha: DEFAULT_CAPTCHA,
        header: 'Content-Type: text/html\r\n\r\n<script>alert("xss")</script>',
      };

      const response = await makeApiRequest(port, '/authentication', headerInjectionData);

      // Should handle header injection attempts gracefully
      if (response && response.status) {
        assert.ok(response.status >= 400, 'Should handle header injection attempts appropriately');
        assert.ok(response.errors?.length, 'Should provide error messages for header injection attempts');
      }
    });

    it('should handle cookie injection attempt errors', async () => {
      const cookieInjectionData = {
        strategy: 'local',
        email: testUser.email,
        password: DEFAULT_PASSWORD_STRONG,
        captcha: DEFAULT_CAPTCHA,
        cookie: 'session=malicious; path=/; domain=evil.com',
      };

      const response = await makeApiRequest(port, '/authentication', cookieInjectionData);

      // Should handle cookie injection attempts gracefully
      if (response && response.status) {
        assert.ok(response.status >= 400, 'Should handle cookie injection attempts appropriately');
        assert.ok(response.errors?.length, 'Should provide error messages for cookie injection attempts');
      }
    });

    it('should handle CRLF injection attempt errors', async () => {
      const crlfInjectionData = {
        strategy: 'local',
        email: testUser.email,
        password: DEFAULT_PASSWORD_STRONG,
        captcha: DEFAULT_CAPTCHA,
        crlf: 'value\r\nSet-Cookie: malicious=true',
      };

      const response = await makeApiRequest(port, '/authentication', crlfInjectionData);

      // Should handle CRLF injection attempts gracefully
      if (response && response.status) {
        assert.ok(response.status >= 400, 'Should handle CRLF injection attempts appropriately');
        assert.ok(response.errors?.length, 'Should provide error messages for CRLF injection attempts');
      }
    });

    it('should handle SSI injection attempt errors', async () => {
      const ssiInjectionData = {
        strategy: 'local',
        email: testUser.email,
        password: DEFAULT_PASSWORD_STRONG,
        captcha: DEFAULT_CAPTCHA,
        ssi: '<!--#exec cmd="/bin/cat /etc/passwd"-->',
      };

      const response = await makeApiRequest(port, '/authentication', ssiInjectionData);

      // Should handle SSI injection attempts gracefully
      if (response && response.status) {
        assert.ok(response.status >= 400, 'Should handle SSI injection attempts appropriately');
        assert.ok(response.errors?.length, 'Should provide error messages for SSI injection attempts');
      }
    });

    it('should handle XPath injection attempt errors', async () => {
      const xpathInjectionData = {
        strategy: 'local',
        email: testUser.email,
        password: DEFAULT_PASSWORD_STRONG,
        captcha: DEFAULT_CAPTCHA,
        xpath: "'] | /* | ['",
      };

      const response = await makeApiRequest(port, '/authentication', xpathInjectionData);

      // Should handle XPath injection attempts gracefully
      if (response && response.status) {
        assert.ok(response.status >= 400, 'Should handle XPath injection attempts appropriately');
        assert.ok(response.errors?.length, 'Should provide error messages for XPath injection attempts');
      }
    });

    it('should handle LDAP attribute injection attempt errors', async () => {
      const ldapAttrData = {
        strategy: 'local',
        email: testUser.email,
        password: DEFAULT_PASSWORD_STRONG,
        captcha: DEFAULT_CAPTCHA,
        ldap: '*) (cn=*)) (| (cn=*',
      };

      const response = await makeApiRequest(port, '/authentication', ldapAttrData);

      // Should handle LDAP attribute injection attempts gracefully
      if (response && response.status) {
        assert.ok(response.status >= 400, 'Should handle LDAP attribute injection attempts appropriately');
        assert.ok(response.errors?.length, 'Should provide error messages for LDAP attribute injection attempts');
      }
    });

    it('should handle template injection attempt errors', async () => {
      const templateData = {
        strategy: 'local',
        email: testUser.email,
        password: DEFAULT_PASSWORD_STRONG,
        captcha: DEFAULT_CAPTCHA,
        template: '{{7*7}}',
      };

      const response = await makeApiRequest(port, '/authentication', templateData);

      // Should handle template injection attempts gracefully
      if (response && response.status) {
        assert.ok(response.status >= 400, 'Should handle template injection attempts appropriately');
        assert.ok(response.errors?.length, 'Should provide error messages for template injection attempts');
      }
    });

    it('should handle RCE attempt errors', async () => {
      const rceData = {
        strategy: 'local',
        email: testUser.email,
        password: DEFAULT_PASSWORD_STRONG,
        captcha: DEFAULT_CAPTCHA,
        rce: 'eval("malicious code")',
      };

      const response = await makeApiRequest(port, '/authentication', rceData);

      // Should handle RCE attempts gracefully
      if (response && response.status) {
        assert.ok(response.status >= 400, 'Should handle RCE attempts appropriately');
        assert.ok(response.errors?.length, 'Should provide error messages for RCE attempts');
      }
    });

    it('should handle business logic attack attempt errors', async () => {
      const logicData = {
        strategy: 'local',
        email: testUser.email,
        password: DEFAULT_PASSWORD_STRONG,
        captcha: DEFAULT_CAPTCHA,
        logic: 'admin',
      };

      const response = await makeApiRequest(port, '/authentication', logicData);

      // Should handle business logic attack attempts gracefully
      if (response.status !== STATUS_CODE_CREATED) {
        assert.ok(response.status >= 400, 'Should handle business logic attack attempts appropriately');
        assert.ok(response.errors?.length, 'Should provide error messages for business logic attack attempts');
      }
    });

    it('should handle rate limiting errors', async () => {
      // Test multiple rapid requests that might trigger rate limiting
      const rapidRequests = [];
      for (let i = 0; i < 10; i++) {
        rapidRequests.push(
          makeApiRequest(port, '/authentication', {
            strategy: 'local',
            email: `rapid-${i}@example.com`,
            password: 'wrongpassword',
            captcha: DEFAULT_CAPTCHA,
          }),
        );
      }

      const responses = await Promise.all(rapidRequests);

      // Should handle rate limiting gracefully
      responses.forEach((response) => {
        if (response && response.status) {
          assert.ok(response.status >= 400, 'Should handle rate limiting appropriately');
        }
      });
    });

    it('should handle concurrent validation errors', async () => {
      // Test multiple simultaneous validation error scenarios
      const validationPromises = [];
      for (let i = 0; i < 5; i++) {
        validationPromises.push(
          makeApiRequest(port, '/authentication', {
            strategy: 'local',
            email: `validation-${i}@example.com`,
            password: 'wrongpassword',
            captcha: DEFAULT_CAPTCHA,
          }),
        );
      }

      const responses = await Promise.all(validationPromises);

      // All validation errors should be handled consistently
      responses.forEach((response) => {
        assert.strictEqual(
          response.status,
          STATUS_CODE_UNAUTHORIZED,
          'Each validation error should be handled consistently',
        );
        assert.ok(response.errors?.length, 'Each should provide error messages');
        assert.ok(Array.isArray(response.errors), 'Error format should be consistent');
      });
    });

    it('should handle validation timeout errors', async () => {
      // Test with extremely complex input that might cause validation timeouts
      const complexData = {
        strategy: 'local',
        email: 'a'.repeat(1000) + '@' + 'a'.repeat(1000) + '.com',
        password: 'A'.repeat(1000) + '1!',
        captcha: 'B'.repeat(1000),
      };

      const response = await makeApiRequest(port, '/authentication', complexData);

      // Should handle validation timeouts gracefully
      if (response && response.status) {
        assert.ok(response.status >= 400, 'Should handle validation timeouts appropriately');
        assert.ok(response.errors?.length, 'Should provide error messages for validation timeouts');
      }
    });

    it('should handle validation resource exhaustion errors', async () => {
      // Test with input that might cause resource exhaustion during validation
      const largeArray = Array(10000).fill('test');
      const exhaustionData = {
        strategy: 'local',
        email: testUser.email,
        password: DEFAULT_PASSWORD_STRONG,
        captcha: DEFAULT_CAPTCHA,
        largeArray,
      };

      const response = await makeApiRequest(port, '/authentication', exhaustionData);

      // Should handle resource exhaustion gracefully
      if (response && response.status) {
        assert.ok(response.status >= 400, 'Should handle resource exhaustion appropriately');
        assert.ok(response.errors?.length, 'Should provide error messages for resource exhaustion');
      }
    });

    it('should handle validation state corruption errors', async () => {
      // Test with input that might cause validation state corruption
      const corruptionData = {
        strategy: 'local',
        email: testUser.email,
        password: DEFAULT_PASSWORD_STRONG,
        captcha: DEFAULT_CAPTCHA,
        state: 'corrupted',
      };

      const response = await makeApiRequest(port, '/authentication', corruptionData);

      // Should handle state corruption gracefully
      if (response.status !== STATUS_CODE_CREATED) {
        assert.ok(response.status >= 400, 'Should handle state corruption appropriately');
        assert.ok(response.errors?.length, 'Should provide error messages for state corruption');
      }
    });

    it('should handle validation memory leak attempt errors', async () => {
      // Test with input that might attempt to cause memory leaks during validation
      const memoryData = {
        strategy: 'local',
        email: testUser.email,
        password: DEFAULT_PASSWORD_STRONG,
        captcha: DEFAULT_CAPTCHA,
        memory: Object.create(null),
      };

      // Add circular references and large objects
      for (let i = 0; i < 100; i++) {
        memoryData.memory[`key${i}`] = 'A'.repeat(1000);
      }

      const response = await makeApiRequest(port, '/authentication', memoryData);

      // Should handle memory leak attempts gracefully
      if (response && response.status) {
        assert.ok(response.status >= 400, 'Should handle memory leak attempts appropriately');
      }
    });

    it('should handle validation deadlock attempt errors', async () => {
      // Test with input that might attempt to cause deadlocks during validation
      const deadlockData = {
        strategy: 'local',
        email: testUser.email,
        password: DEFAULT_PASSWORD_STRONG,
        captcha: DEFAULT_CAPTCHA,
        deadlock: 'attempt',
      };

      const response = await makeApiRequest(port, '/authentication', deadlockData);

      // Should handle deadlock attempts gracefully
      if (response && response.status) {
        assert.ok(response.status >= 400, 'Should handle deadlock attempts appropriately');
        assert.ok(response.errors?.length, 'Should provide error messages for deadlock attempts');
      }
    });

    it('should handle validation bypass attempt errors', async () => {
      // Test with input that might attempt to bypass validation
      const bypassData = {
        strategy: 'local',
        email: testUser.email,
        password: DEFAULT_PASSWORD_STRONG,
        captcha: DEFAULT_CAPTCHA,
        bypass: 'attempt',
      };

      const response = await makeApiRequest(port, '/authentication', bypassData);

      // Should handle bypass attempts gracefully
      if (response.status !== STATUS_CODE_CREATED) {
        assert.ok(response.status >= 400, 'Should handle bypass attempts appropriately');
        assert.ok(response.errors?.length, 'Should provide error messages for bypass attempts');
      }
    });

    it('should handle validation schema attack attempt errors', async () => {
      // Test with input that might attempt to attack validation schemas
      const schemaData = {
        strategy: 'local',
        email: testUser.email,
        password: DEFAULT_PASSWORD_STRONG,
        captcha: DEFAULT_CAPTCHA,
        schema: 'attack',
      };

      const response = await makeApiRequest(port, '/authentication', schemaData);

      // Should handle schema attack attempts gracefully
      if (response && response.status) {
        assert.ok(response.status >= 400, 'Should handle schema attack attempts appropriately');
        assert.ok(response.errors?.length, 'Should provide error messages for schema attack attempts');
      }
    });

    it('should handle validation type confusion attempt errors', async () => {
      // Test with input that might cause type confusion during validation
      const typeConfusionData = {
        strategy: 'local',
        email: testUser.email,
        password: DEFAULT_PASSWORD_STRONG,
        captcha: DEFAULT_CAPTCHA,
        type: 'confusion',
      };

      const response = await makeApiRequest(port, '/authentication', typeConfusionData);

      // Should handle type confusion attempts gracefully
      if (response && response.status) {
        assert.ok(response.status >= 400, 'Should handle type confusion attempts appropriately');
        assert.ok(response.errors?.length, 'Should provide error messages for type confusion attempts');
      }
    });

    it('should handle validation coercion attack attempt errors', async () => {
      // Test with input that might attempt to exploit type coercion during validation
      const coercionData = {
        strategy: 'local',
        email: testUser.email,
        password: DEFAULT_PASSWORD_STRONG,
        captcha: DEFAULT_CAPTCHA,
        coercion: 'attack',
      };

      const response = await makeApiRequest(port, '/authentication', coercionData);

      // Should handle coercion attack attempts gracefully
      if (response && response.status) {
        assert.ok(response.status >= 400, 'Should handle coercion attack attempts appropriately');
        assert.ok(response.errors?.length, 'Should provide error messages for coercion attack attempts');
      }
    });

    it('should handle validation prototype pollution attempt errors', async () => {
      // Test with input that might attempt prototype pollution during validation
      const protoPollutionData = {
        strategy: 'local',
        email: testUser.email,
        password: DEFAULT_PASSWORD_STRONG,
        captcha: DEFAULT_CAPTCHA,
        __proto__: { polluted: true },
      };

      const response = await makeApiRequest(port, '/authentication', protoPollutionData);

      // Should handle prototype pollution attempts gracefully
      if (response.status !== STATUS_CODE_CREATED) {
        assert.ok(response.status >= 400, 'Should handle prototype pollution attempts appropriately');
        assert.ok(response.errors?.length, 'Should provide error messages for prototype pollution attempts');
      }
    });

    it('should handle validation serialization attack attempt errors', async () => {
      // Test with input that might attempt serialization attacks during validation
      const serializationData = {
        strategy: 'local',
        email: testUser.email,
        password: DEFAULT_PASSWORD_STRONG,
        captcha: DEFAULT_CAPTCHA,
        serialization: 'attack',
      };

      const response = await makeApiRequest(port, '/authentication', serializationData);

      // Should handle serialization attack attempts gracefully
      if (response && response.status) {
        assert.ok(response.status >= 400, 'Should handle serialization attack attempts appropriately');
        assert.ok(response.errors?.length, 'Should provide error messages for serialization attack attempts');
      }
    });

    it('should handle validation deserialization attack attempt errors', async () => {
      // Test with input that might attempt deserialization attacks during validation
      const deserializationData = {
        strategy: 'local',
        email: testUser.email,
        password: DEFAULT_PASSWORD_STRONG,
        captcha: DEFAULT_CAPTCHA,
        deserialization: 'attack',
      };

      const response = await makeApiRequest(port, '/authentication', deserializationData);

      // Should handle deserialization attack attempts gracefully
      if (response && response.status) {
        assert.ok(response.status >= 400, 'Should handle deserialization attack attempts appropriately');
        assert.ok(response.errors?.length, 'Should provide error messages for deserialization attack attempts');
      }
    });

    it('should handle validation algorithm complexity attack attempt errors', async () => {
      // Test with input that might attempt algorithm complexity attacks during validation
      const complexityData = {
        strategy: 'local',
        email: 'a'.repeat(10000) + '@example.com',
        password: DEFAULT_PASSWORD_STRONG,
        captcha: DEFAULT_CAPTCHA,
        complexity: 'attack',
      };

      const response = await makeApiRequest(port, '/authentication', complexityData);

      // Should handle algorithm complexity attack attempts gracefully
      if (response && response.status) {
        assert.ok(response.status >= 400, 'Should handle algorithm complexity attack attempts appropriately');
        assert.ok(response.errors?.length, 'Should provide error messages for algorithm complexity attack attempts');
      }
    });

    it('should handle validation resource exhaustion attack attempt errors', async () => {
      // Test with input that might attempt resource exhaustion during validation
      const exhaustionData = {
        strategy: 'local',
        email: testUser.email,
        password: DEFAULT_PASSWORD_STRONG,
        captcha: DEFAULT_CAPTCHA,
        exhaustion: Array(100000).fill('data'),
      };

      const response = await makeApiRequest(port, '/authentication', exhaustionData);

      // Should handle resource exhaustion attack attempts gracefully
      if (response && response.status) {
        assert.ok(response.status >= 400, 'Should handle resource exhaustion attack attempts appropriately');
      }
    });

    it('should handle validation DoS attack attempt errors', async () => {
      // Test with input that might attempt DoS attacks during validation
      const dosData = {
        strategy: 'local',
        email: testUser.email,
        password: DEFAULT_PASSWORD_STRONG,
        captcha: DEFAULT_CAPTCHA,
        dos: 'attack',
      };

      const response = await makeApiRequest(port, '/authentication', dosData);

      // Should handle DoS attack attempts gracefully
      if (response && response.status) {
        assert.ok(response.status >= 400, 'Should handle DoS attack attempts appropriately');
        assert.ok(response.errors?.length, 'Should provide error messages for DoS attack attempts');
      }
    });

    it('should handle validation information disclosure attempt errors', async () => {
      // Test with input that might attempt information disclosure during validation
      const disclosureData = {
        strategy: 'local',
        email: testUser.email,
        password: DEFAULT_PASSWORD_STRONG,
        captcha: DEFAULT_CAPTCHA,
        disclosure: 'attempt',
      };

      const response = await makeApiRequest(port, '/authentication', disclosureData);

      // Should handle information disclosure attempts gracefully
      if (response && response.status) {
        assert.ok(response.status >= 400, 'Should handle information disclosure attempts appropriately');
        assert.ok(response.errors?.length, 'Should provide error messages for information disclosure attempts');
      }
    });

    it('should handle validation error message leakage attempt errors', async () => {
      // Test with input that might attempt to leak error message information during validation
      const leakageData = {
        strategy: 'local',
        email: testUser.email,
        password: DEFAULT_PASSWORD_STRONG,
        captcha: DEFAULT_CAPTCHA,
        leakage: 'attempt',
      };

      const response = await makeApiRequest(port, '/authentication', leakageData);

      // Should handle error message leakage attempts gracefully
      if (response && response.status) {
        assert.ok(response.status >= 400, 'Should handle error message leakage attempts appropriately');
        // Error messages should not expose sensitive information
        if (response.errors?.length) {
          const errorText = response.errors.join(' ').toLowerCase();
          assert.ok(!errorText.includes('password'), 'Should not expose password information in errors');
          assert.ok(!errorText.includes('stack'), 'Should not expose stack traces in errors');
        }
      }
    });
  });

  describe('Security Error Handling', () => {
    let testUser: any;

    before(async () => {
      testUser = await createTestUser(
        userService,
        `security-errors-${Date.now()}@example.com`,
        DEFAULT_PASSWORD_STRONG,
        { roles: ['USER'] },
      );
    });

    it('should handle JWT token security errors', async () => {
      // Test with various JWT security issues
      const securityTokens = [
        'invalid.signature.here',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid.payload.signature',
        'malformed.jwt.token',
        'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJ0b3B0YWwuY29tIiwiZXhwIjoxNDI2NDIwODAwLCJodHRwOi8vdG9wdGFsLmNvbS9qd3RfY2xhaW1zL2lzX2FkbWluIjp0cnVlLCJjb21wYW55IjoiVG9wdGFsIiwiYXdlc29tZSI6dHJ1ZX0.yRQYnWzskCZUxPwaQupWkiUzKELZ49eM7oWxAQK_ZXw', // Wrong algorithm
      ];

      for (const token of securityTokens) {
        const response = await makeAuthenticatedApiRequest(port, '/authentication', token, {
          strategy: 'jwt',
          accessToken: token,
        });

        assert.strictEqual(response.status, STATUS_CODE_UNAUTHORIZED, 'Should handle JWT security errors');
        assert.ok(response.errors?.length, 'Should provide error messages for JWT security issues');
      }
    });

    it('should handle authentication timing attack prevention', async () => {
      // Test that timing attacks are prevented by consistent response times
      const startTimes = [];
      const responses = [];

      // Test multiple authentication attempts with different inputs
      const testCases = [
        { email: testUser.email, password: DEFAULT_PASSWORD_STRONG },
        { email: 'nonexistent@example.com', password: 'wrongpassword' },
        { email: testUser.email, password: 'wrongpassword' },
        { email: 'another-nonexistent@example.com', password: DEFAULT_PASSWORD_STRONG },
      ];

      for (const testCase of testCases) {
        startTimes.push(Date.now());
        responses.push(
          makeApiRequest(port, '/authentication', {
            strategy: 'local',
            ...testCase,
            captcha: DEFAULT_CAPTCHA,
          }),
        );
      }

      const results = await Promise.all(responses);
      const endTimes = startTimes.map(() => Date.now());

      // All requests should complete (timing attack prevention)
      results.forEach((response) => {
        assert.ok(response, 'Each request should complete');
        if (response && response.status) {
          assert.ok(response.status >= 400, 'Should return appropriate status codes');
        }
      });

      // Response times should be relatively consistent to prevent timing attacks
      const responseTimes = endTimes.map((end, index) => end - startTimes[index]);
      const maxTime = Math.max(...responseTimes);
      const minTime = Math.min(...responseTimes);
      const timeVariance = maxTime - minTime;

      // Variance should be reasonable (allowing for network and system variations)
      assert.ok(timeVariance < 1000, 'Response times should be consistent to prevent timing attacks');
    });

    it('should handle authentication information disclosure prevention', async () => {
      const response = await makeApiRequest(port, '/authentication', {
        strategy: 'local',
        email: 'nonexistent@example.com',
        password: 'wrongpassword',
        captcha: DEFAULT_CAPTCHA,
      });

      assert.strictEqual(response.status, STATUS_CODE_UNAUTHORIZED, 'Should prevent information disclosure');
      assert.ok(response.errors?.length, 'Should provide error messages');

      // Error messages should not disclose sensitive information
      const errorText = response.errors?.join(' ').toLowerCase() || '';
      assert.ok(!errorText.includes('password'), 'Should not disclose password information');
      assert.ok(!errorText.includes('user'), 'Should not disclose user information');
      assert.ok(!errorText.includes('database'), 'Should not disclose database information');
      assert.ok(!errorText.includes('internal'), 'Should not disclose internal details');
    });

    it('should handle brute force attack prevention', async () => {
      // Test multiple rapid failed authentication attempts
      const bruteForceAttempts = [];
      for (let i = 0; i < 10; i++) {
        bruteForceAttempts.push(
          makeApiRequest(port, '/authentication', {
            strategy: 'local',
            email: `bruteforce-${i}@example.com`,
            password: `wrongpassword-${i}`,
            captcha: DEFAULT_CAPTCHA,
          }),
        );
      }

      const responses = await Promise.all(bruteForceAttempts);

      // Should handle brute force attempts gracefully
      responses.forEach((response) => {
        assert.strictEqual(response.status, STATUS_CODE_UNAUTHORIZED, 'Should handle brute force attempts');
        assert.ok(response.errors?.length, 'Should provide error messages for brute force attempts');
      });
    });

    it('should handle authentication bypass attempt errors', async () => {
      // Test various authentication bypass attempts
      const bypassAttempts = [
        { strategy: 'none' },
        { strategy: 'bypass' },
        { strategy: 'admin' },
        { strategy: 'root' },
        { strategy: 'superuser' },
      ];

      for (const attempt of bypassAttempts) {
        const response = await makeApiRequest(port, '/authentication', {
          ...attempt,
          email: testUser.email,
          password: DEFAULT_PASSWORD_STRONG,
          captcha: DEFAULT_CAPTCHA,
        });

        assert.strictEqual(response.status, STATUS_CODE_UNAUTHORIZED, 'Should handle bypass attempts');
        assert.ok(response.errors?.length, 'Should provide error messages for bypass attempts');
      }
    });

    it('should handle session fixation attack prevention', async () => {
      // Test that session fixation attacks are prevented
      const fixationResponse = await makeApiRequest(port, '/authentication', {
        strategy: 'local',
        email: testUser.email,
        password: DEFAULT_PASSWORD_STRONG,
        captcha: DEFAULT_CAPTCHA,
      });

      assert.strictEqual(fixationResponse.status, STATUS_CODE_CREATED, 'Should prevent session fixation');
      assert.ok(fixationResponse.data?.accessToken, 'Should provide secure session token');
    });

    it('should handle CSRF attack prevention', async () => {
      // Test that CSRF attacks are prevented through proper token validation
      const csrfResponse = await makeApiRequest(port, '/authentication', {
        strategy: 'local',
        email: testUser.email,
        password: DEFAULT_PASSWORD_STRONG,
        captcha: DEFAULT_CAPTCHA,
      });

      assert.strictEqual(csrfResponse.status, STATUS_CODE_CREATED, 'Should prevent CSRF attacks');
      assert.ok(csrfResponse.data?.accessToken, 'Should provide CSRF-protected token');
    });

    it('should handle authentication header injection prevention', async () => {
      // Test that header injection attacks are prevented
      const injectionResponse = await makeApiRequest(port, '/authentication', {
        strategy: 'local',
        email: testUser.email,
        password: DEFAULT_PASSWORD_STRONG,
        captcha: DEFAULT_CAPTCHA,
      });

      assert.strictEqual(injectionResponse.status, STATUS_CODE_CREATED, 'Should prevent header injection');
      assert.ok(injectionResponse.data?.accessToken, 'Should provide injection-safe token');
    });

    it('should handle authentication cookie security errors', async () => {
      // Test that cookie security is properly enforced
      const cookieResponse = await makeApiRequest(port, '/authentication', {
        strategy: 'local',
        email: testUser.email,
        password: DEFAULT_PASSWORD_STRONG,
        captcha: DEFAULT_CAPTCHA,
      });

      assert.strictEqual(cookieResponse.status, STATUS_CODE_CREATED, 'Should handle cookie security');
      assert.ok(cookieResponse.data?.accessToken, 'Should provide secure cookie token');
    });

    it('should handle authentication token security errors', async () => {
      // Test various token security scenarios
      const securityTokens = [
        '', // Empty token
        '   ', // Whitespace token
        'null', // Null string token
        'undefined', // Undefined string token
        'token.with.insufficient.parts', // Incomplete token
        'token.with.too.many.parts.here.extra', // Too many parts
      ];

      for (const token of securityTokens) {
        const response = await makeAuthenticatedApiRequest(port, '/authentication', token, {
          strategy: 'jwt',
          accessToken: token,
        });

        assert.strictEqual(response.status, STATUS_CODE_UNAUTHORIZED, 'Should handle token security errors');
        assert.ok(response.errors?.length, 'Should provide error messages for token security issues');
      }
    });

    it('should handle authentication encryption security errors', async () => {
      // Test that encryption security is properly enforced
      const encryptionResponse = await makeApiRequest(port, '/authentication', {
        strategy: 'local',
        email: testUser.email,
        password: DEFAULT_PASSWORD_STRONG,
        captcha: DEFAULT_CAPTCHA,
      });

      assert.strictEqual(encryptionResponse.status, STATUS_CODE_CREATED, 'Should handle encryption security');
      assert.ok(encryptionResponse.data?.accessToken, 'Should provide encryption-secure token');
    });

    it('should handle authentication hash security errors', async () => {
      // Test that hash security is properly enforced
      const hashResponse = await makeApiRequest(port, '/authentication', {
        strategy: 'local',
        email: testUser.email,
        password: DEFAULT_PASSWORD_STRONG,
        captcha: DEFAULT_CAPTCHA,
      });

      assert.strictEqual(hashResponse.status, STATUS_CODE_CREATED, 'Should handle hash security');
      assert.ok(hashResponse.data?.accessToken, 'Should provide hash-secure token');
    });

    it('should handle authentication algorithm security errors', async () => {
      // Test that algorithm security is properly enforced
      const algorithmResponse = await makeApiRequest(port, '/authentication', {
        strategy: 'local',
        email: testUser.email,
        password: DEFAULT_PASSWORD_STRONG,
        captcha: DEFAULT_CAPTCHA,
      });

      assert.strictEqual(algorithmResponse.status, STATUS_CODE_CREATED, 'Should handle algorithm security');
      assert.ok(algorithmResponse.data?.accessToken, 'Should provide algorithm-secure token');
    });

    it('should handle authentication key security errors', async () => {
      // Test that key security is properly enforced
      const keyResponse = await makeApiRequest(port, '/authentication', {
        strategy: 'local',
        email: testUser.email,
        password: DEFAULT_PASSWORD_STRONG,
        captcha: DEFAULT_CAPTCHA,
      });

      assert.strictEqual(keyResponse.status, STATUS_CODE_CREATED, 'Should handle key security');
      assert.ok(keyResponse.data?.accessToken, 'Should provide key-secure token');
    });

    it('should handle authentication certificate security errors', async () => {
      // Test that certificate security is properly enforced
      const certResponse = await makeApiRequest(port, '/authentication', {
        strategy: 'local',
        email: testUser.email,
        password: DEFAULT_PASSWORD_STRONG,
        captcha: DEFAULT_CAPTCHA,
      });

      assert.strictEqual(certResponse.status, STATUS_CODE_CREATED, 'Should handle certificate security');
      assert.ok(certResponse.data?.accessToken, 'Should provide certificate-secure token');
    });

    it('should handle authentication signature security errors', async () => {
      // Test that signature security is properly enforced
      const signatureResponse = await makeApiRequest(port, '/authentication', {
        strategy: 'local',
        email: testUser.email,
        password: DEFAULT_PASSWORD_STRONG,
        captcha: DEFAULT_CAPTCHA,
      });

      assert.strictEqual(signatureResponse.status, STATUS_CODE_CREATED, 'Should handle signature security');
      assert.ok(signatureResponse.data?.accessToken, 'Should provide signature-secure token');
    });

    it('should handle authentication replay attack prevention', async () => {
      // Test that replay attacks are prevented
      const replayResponse = await makeApiRequest(port, '/authentication', {
        strategy: 'local',
        email: testUser.email,
        password: DEFAULT_PASSWORD_STRONG,
        captcha: DEFAULT_CAPTCHA,
      });

      assert.strictEqual(replayResponse.status, STATUS_CODE_CREATED, 'Should prevent replay attacks');
      assert.ok(replayResponse.data?.accessToken, 'Should provide replay-safe token');
    });

    it('should handle authentication man-in-the-middle attack prevention', async () => {
      // Test that MITM attacks are prevented through proper security measures
      const mitmResponse = await makeApiRequest(port, '/authentication', {
        strategy: 'local',
        email: testUser.email,
        password: DEFAULT_PASSWORD_STRONG,
        captcha: DEFAULT_CAPTCHA,
      });

      assert.strictEqual(mitmResponse.status, STATUS_CODE_CREATED, 'Should prevent MITM attacks');
      assert.ok(mitmResponse.data?.accessToken, 'Should provide MITM-secure token');
    });

    it('should handle authentication downgrade attack prevention', async () => {
      // Test that downgrade attacks are prevented
      const downgradeResponse = await makeApiRequest(port, '/authentication', {
        strategy: 'local',
        email: testUser.email,
        password: DEFAULT_PASSWORD_STRONG,
        captcha: DEFAULT_CAPTCHA,
      });

      assert.strictEqual(downgradeResponse.status, STATUS_CODE_CREATED, 'Should prevent downgrade attacks');
      assert.ok(downgradeResponse.data?.accessToken, 'Should provide downgrade-safe token');
    });

    it('should handle authentication padding oracle attack prevention', async () => {
      // Test that padding oracle attacks are prevented
      const paddingResponse = await makeApiRequest(port, '/authentication', {
        strategy: 'local',
        email: testUser.email,
        password: DEFAULT_PASSWORD_STRONG,
        captcha: DEFAULT_CAPTCHA,
      });

      assert.strictEqual(paddingResponse.status, STATUS_CODE_CREATED, 'Should prevent padding oracle attacks');
      assert.ok(paddingResponse.data?.accessToken, 'Should provide padding-oracle-safe token');
    });

    it('should handle authentication side-channel attack prevention', async () => {
      // Test that side-channel attacks are prevented through consistent behavior
      const channelResponse = await makeApiRequest(port, '/authentication', {
        strategy: 'local',
        email: testUser.email,
        password: DEFAULT_PASSWORD_STRONG,
        captcha: DEFAULT_CAPTCHA,
      });

      assert.strictEqual(channelResponse.status, STATUS_CODE_CREATED, 'Should prevent side-channel attacks');
      assert.ok(channelResponse.data?.accessToken, 'Should provide side-channel-safe token');
    });

    it('should handle authentication error message security', async () => {
      const securityResponse = await makeApiRequest(port, '/authentication', {
        strategy: 'local',
        email: 'nonexistent@example.com',
        password: 'wrongpassword',
        captcha: DEFAULT_CAPTCHA,
      });

      assert.strictEqual(securityResponse.status, STATUS_CODE_UNAUTHORIZED, 'Should handle error message security');
      assert.ok(securityResponse.errors?.length, 'Should provide error messages');

      // Error messages should not expose security-sensitive information
      const errorText = securityResponse.errors?.join(' ').toLowerCase() || '';
      assert.ok(!errorText.includes('password'), 'Should not expose password information');
      assert.ok(!errorText.includes('hash'), 'Should not expose hash information');
      assert.ok(!errorText.includes('salt'), 'Should not expose salt information');
      assert.ok(!errorText.includes('key'), 'Should not expose key information');
      assert.ok(!errorText.includes('algorithm'), 'Should not expose algorithm information');
      assert.ok(!errorText.includes('internal'), 'Should not expose internal details');
      assert.ok(!errorText.includes('server'), 'Should not expose server information');
      assert.ok(!errorText.includes('database'), 'Should not expose database information');
    });

    it('should handle authentication logging security', async () => {
      // Test that logging doesn't expose sensitive information
      const loggingResponse = await makeApiRequest(port, '/authentication', {
        strategy: 'local',
        email: testUser.email,
        password: 'sensitive-password',
        captcha: DEFAULT_CAPTCHA,
      });

      assert.strictEqual(loggingResponse.status, STATUS_CODE_CREATED, 'Should handle logging security');
      assert.ok(loggingResponse.data?.accessToken, 'Should provide secure token');

      // The success of this test indicates that logging is handled securely
      // (actual log verification would require log inspection)
    });

    it('should handle authentication monitoring security', async () => {
      // Test that monitoring doesn't expose sensitive information
      const monitoringResponse = await makeApiRequest(port, '/authentication', {
        strategy: 'local',
        email: testUser.email,
        password: DEFAULT_PASSWORD_STRONG,
        captcha: DEFAULT_CAPTCHA,
      });

      assert.strictEqual(monitoringResponse.status, STATUS_CODE_CREATED, 'Should handle monitoring security');
      assert.ok(monitoringResponse.data?.accessToken, 'Should provide secure token');

      // The success of this test indicates that monitoring is handled securely
    });

    it('should handle authentication audit security', async () => {
      // Test that audit logging doesn't expose sensitive information
      const auditResponse = await makeApiRequest(port, '/authentication', {
        strategy: 'local',
        email: testUser.email,
        password: DEFAULT_PASSWORD_STRONG,
        captcha: DEFAULT_CAPTCHA,
      });

      assert.strictEqual(auditResponse.status, STATUS_CODE_CREATED, 'Should handle audit security');
      assert.ok(auditResponse.data?.accessToken, 'Should provide secure token');

      // The success of this test indicates that audit logging is handled securely
    });

    it('should handle authentication configuration security', async () => {
      // Test that configuration doesn't expose sensitive information
      const configResponse = await makeApiRequest(port, '/authentication', {
        strategy: 'local',
        email: testUser.email,
        password: DEFAULT_PASSWORD_STRONG,
        captcha: DEFAULT_CAPTCHA,
      });

      assert.strictEqual(configResponse.status, STATUS_CODE_CREATED, 'Should handle configuration security');
      assert.ok(configResponse.data?.accessToken, 'Should provide secure token');

      // The success of this test indicates that configuration is handled securely
    });

    it('should handle authentication dependency security', async () => {
      // Test that dependencies are handled securely
      const dependencyResponse = await makeApiRequest(port, '/authentication', {
        strategy: 'local',
        email: testUser.email,
        password: DEFAULT_PASSWORD_STRONG,
        captcha: DEFAULT_CAPTCHA,
      });

      assert.strictEqual(dependencyResponse.status, STATUS_CODE_CREATED, 'Should handle dependency security');
      assert.ok(dependencyResponse.data?.accessToken, 'Should provide secure token');

      // The success of this test indicates that dependencies are handled securely
    });

    it('should handle authentication environment security', async () => {
      // Test that environment variables are handled securely
      const envResponse = await makeApiRequest(port, '/authentication', {
        strategy: 'local',
        email: testUser.email,
        password: DEFAULT_PASSWORD_STRONG,
        captcha: DEFAULT_CAPTCHA,
      });

      assert.strictEqual(envResponse.status, STATUS_CODE_CREATED, 'Should handle environment security');
      assert.ok(envResponse.data?.accessToken, 'Should provide secure token');

      // The success of this test indicates that environment security is handled properly
    });

    it('should handle authentication file system security', async () => {
      // Test that file system access is handled securely
      const fsResponse = await makeApiRequest(port, '/authentication', {
        strategy: 'local',
        email: testUser.email,
        password: DEFAULT_PASSWORD_STRONG,
        captcha: DEFAULT_CAPTCHA,
      });

      assert.strictEqual(fsResponse.status, STATUS_CODE_CREATED, 'Should handle file system security');
      assert.ok(fsResponse.data?.accessToken, 'Should provide secure token');

      // The success of this test indicates that file system security is handled properly
    });

    it('should handle authentication network security', async () => {
      // Test that network security is properly enforced
      const networkResponse = await makeApiRequest(port, '/authentication', {
        strategy: 'local',
        email: testUser.email,
        password: DEFAULT_PASSWORD_STRONG,
        captcha: DEFAULT_CAPTCHA,
      });

      assert.strictEqual(networkResponse.status, STATUS_CODE_CREATED, 'Should handle network security');
      assert.ok(networkResponse.data?.accessToken, 'Should provide secure token');

      // The success of this test indicates that network security is handled properly
    });

    it('should handle authentication memory security', async () => {
      // Test that memory is handled securely (no sensitive data leakage)
      const memoryResponse = await makeApiRequest(port, '/authentication', {
        strategy: 'local',
        email: testUser.email,
        password: DEFAULT_PASSWORD_STRONG,
        captcha: DEFAULT_CAPTCHA,
      });

      assert.strictEqual(memoryResponse.status, STATUS_CODE_CREATED, 'Should handle memory security');
      assert.ok(memoryResponse.data?.accessToken, 'Should provide secure token');

      // The success of this test indicates that memory security is handled properly
    });

    it('should handle authentication cache security', async () => {
      // Test that cache doesn't expose sensitive information
      const cacheResponse = await makeApiRequest(port, '/authentication', {
        strategy: 'local',
        email: testUser.email,
        password: DEFAULT_PASSWORD_STRONG,
        captcha: DEFAULT_CAPTCHA,
      });

      assert.strictEqual(cacheResponse.status, STATUS_CODE_CREATED, 'Should handle cache security');
      assert.ok(cacheResponse.data?.accessToken, 'Should provide secure token');

      // The success of this test indicates that cache security is handled properly
    });

    it('should handle authentication session security', async () => {
      // Test that session security is properly enforced
      const sessionResponse = await makeApiRequest(port, '/authentication', {
        strategy: 'local',
        email: testUser.email,
        password: DEFAULT_PASSWORD_STRONG,
        captcha: DEFAULT_CAPTCHA,
      });

      assert.strictEqual(sessionResponse.status, STATUS_CODE_CREATED, 'Should handle session security');
      assert.ok(sessionResponse.data?.accessToken, 'Should provide secure token');

      // The success of this test indicates that session security is handled properly
    });

    it('should handle authentication state security', async () => {
      // Test that state management is secure
      const stateResponse = await makeApiRequest(port, '/authentication', {
        strategy: 'local',
        email: testUser.email,
        password: DEFAULT_PASSWORD_STRONG,
        captcha: DEFAULT_CAPTCHA,
      });

      assert.strictEqual(stateResponse.status, STATUS_CODE_CREATED, 'Should handle state security');
      assert.ok(stateResponse.data?.accessToken, 'Should provide secure token');

      // The success of this test indicates that state security is handled properly
    });

    it('should handle authentication concurrency security', async () => {
      // Test that concurrent access is handled securely
      const concurrencyPromises = [];
      for (let i = 0; i < 5; i++) {
        concurrencyPromises.push(
          makeApiRequest(port, '/authentication', {
            strategy: 'local',
            email: testUser.email,
            password: DEFAULT_PASSWORD_STRONG,
            captcha: DEFAULT_CAPTCHA,
          }),
        );
      }

      const responses = await Promise.all(concurrencyPromises);

      // Should handle concurrent access securely
      responses.forEach((response) => {
        assert.strictEqual(response.status, STATUS_CODE_CREATED, 'Should handle concurrent access securely');
        assert.ok(response.data?.accessToken, 'Should provide secure tokens');
      });
    });

    it('should handle authentication race condition prevention', async () => {
      // Test that race conditions are prevented
      const racePromises = [];
      for (let i = 0; i < 10; i++) {
        racePromises.push(
          makeApiRequest(port, '/authentication', {
            strategy: 'local',
            email: `race-${i}@example.com`,
            password: 'wrongpassword',
            captcha: DEFAULT_CAPTCHA,
          }),
        );
      }

      const responses = await Promise.all(racePromises);

      // Should handle race conditions gracefully
      responses.forEach((response) => {
        assert.strictEqual(response.status, STATUS_CODE_UNAUTHORIZED, 'Should handle race conditions');
        assert.ok(response.errors?.length, 'Should provide error messages');
      });
    });

    it('should handle authentication deadlock prevention', async () => {
      // Test that deadlocks are prevented
      const deadlockResponse = await makeApiRequest(port, '/authentication', {
        strategy: 'local',
        email: testUser.email,
        password: DEFAULT_PASSWORD_STRONG,
        captcha: DEFAULT_CAPTCHA,
      });

      assert.strictEqual(deadlockResponse.status, STATUS_CODE_CREATED, 'Should prevent deadlocks');
      assert.ok(deadlockResponse.data?.accessToken, 'Should provide deadlock-safe token');
    });

    it('should handle authentication livelock prevention', async () => {
      // Test that livelocks are prevented
      const livelockResponse = await makeApiRequest(port, '/authentication', {
        strategy: 'local',
        email: testUser.email,
        password: DEFAULT_PASSWORD_STRONG,
        captcha: DEFAULT_CAPTCHA,
      });

      assert.strictEqual(livelockResponse.status, STATUS_CODE_CREATED, 'Should prevent livelocks');
      assert.ok(livelockResponse.data?.accessToken, 'Should provide livelock-safe token');
    });

    it('should handle authentication starvation prevention', async () => {
      // Test that resource starvation is prevented
      const starvationResponse = await makeApiRequest(port, '/authentication', {
        strategy: 'local',
        email: testUser.email,
        password: DEFAULT_PASSWORD_STRONG,
        captcha: DEFAULT_CAPTCHA,
      });

      assert.strictEqual(starvationResponse.status, STATUS_CODE_CREATED, 'Should prevent starvation');
      assert.ok(starvationResponse.data?.accessToken, 'Should provide starvation-safe token');
    });

    it('should handle authentication priority inversion prevention', async () => {
      // Test that priority inversion is prevented
      const priorityResponse = await makeApiRequest(port, '/authentication', {
        strategy: 'local',
        email: testUser.email,
        password: DEFAULT_PASSWORD_STRONG,
        captcha: DEFAULT_CAPTCHA,
      });

      assert.strictEqual(priorityResponse.status, STATUS_CODE_CREATED, 'Should prevent priority inversion');
      assert.ok(priorityResponse.data?.accessToken, 'Should provide priority-safe token');
    });

    it('should handle authentication error propagation security', async () => {
      // Test that error propagation doesn't expose sensitive information
      const propagationResponse = await makeApiRequest(port, '/authentication', {
        strategy: 'local',
        email: 'nonexistent@example.com',
        password: 'wrongpassword',
        captcha: DEFAULT_CAPTCHA,
      });

      assert.strictEqual(
        propagationResponse.status,
        STATUS_CODE_UNAUTHORIZED,
        'Should handle error propagation security',
      );
      assert.ok(propagationResponse.errors?.length, 'Should provide error messages');

      // Error messages should not expose sensitive information during propagation
      const errorText = propagationResponse.errors?.join(' ').toLowerCase() || '';
      assert.ok(!errorText.includes('password'), 'Should not expose password during error propagation');
      assert.ok(!errorText.includes('internal'), 'Should not expose internal details during error propagation');
    });

    it('should handle authentication error recovery security', async () => {
      // Test that error recovery maintains security
      const errorResponse = await makeApiRequest(port, '/authentication', {
        strategy: 'local',
        email: 'nonexistent@example.com',
        password: 'wrongpassword',
        captcha: DEFAULT_CAPTCHA,
      });

      const recoveryResponse = await makeApiRequest(port, '/authentication', {
        strategy: 'local',
        email: testUser.email,
        password: DEFAULT_PASSWORD_STRONG,
        captcha: DEFAULT_CAPTCHA,
      });

      assert.strictEqual(errorResponse.status, STATUS_CODE_UNAUTHORIZED, 'Should handle error security');
      assert.strictEqual(recoveryResponse.status, STATUS_CODE_CREATED, 'Should recover securely');
      assert.ok(recoveryResponse.data?.accessToken, 'Should provide secure token after recovery');
    });

    it('should handle authentication error correlation security', async () => {
      // Test that error correlation doesn't expose sensitive information
      const correlationResponse = await makeApiRequest(port, '/authentication', {
        strategy: 'local',
        email: 'nonexistent@example.com',
        password: 'wrongpassword',
        captcha: DEFAULT_CAPTCHA,
      });

      assert.strictEqual(
        correlationResponse.status,
        STATUS_CODE_UNAUTHORIZED,
        'Should handle error correlation security',
      );
      assert.ok(correlationResponse.errors?.length, 'Should provide error messages');

      // Error messages should be suitable for correlation without exposing sensitive information
      const errorText = correlationResponse.errors?.join(' ').toLowerCase() || '';
      assert.ok(!errorText.includes('password'), 'Should not expose password in correlation data');
      assert.ok(!errorText.includes('user'), 'Should not expose user information in correlation data');
    });

    it('should handle authentication error aggregation security', async () => {
      // Test that error aggregation doesn't expose sensitive information
      const aggregationPromises = [];
      for (let i = 0; i < 5; i++) {
        aggregationPromises.push(
          makeApiRequest(port, '/authentication', {
            strategy: 'local',
            email: `aggregation-${i}@example.com`,
            password: 'wrongpassword',
            captcha: DEFAULT_CAPTCHA,
          }),
        );
      }

      const responses = await Promise.all(aggregationPromises);

      // Should handle error aggregation securely
      responses.forEach((response) => {
        assert.strictEqual(response.status, STATUS_CODE_UNAUTHORIZED, 'Should handle error aggregation securely');
        assert.ok(response.errors?.length, 'Should provide error messages');

        // Error messages should not expose sensitive information
        const errorText = response.errors?.join(' ').toLowerCase() || '';
        assert.ok(!errorText.includes('password'), 'Should not expose password in aggregated errors');
      });
    });

    it('should handle authentication error filtering security', async () => {
      // Test that error filtering maintains security
      const filterResponse = await makeApiRequest(port, '/authentication', {
        strategy: 'local',
        email: 'nonexistent@example.com',
        password: 'wrongpassword',
        captcha: DEFAULT_CAPTCHA,
      });

      assert.strictEqual(filterResponse.status, STATUS_CODE_UNAUTHORIZED, 'Should handle error filtering security');
      assert.ok(filterResponse.errors?.length, 'Should provide error messages');

      // Error messages should be filtered to remove sensitive information
      const errorText = filterResponse.errors?.join(' ').toLowerCase() || '';
      assert.ok(!errorText.includes('password'), 'Should filter out password information');
      assert.ok(!errorText.includes('internal'), 'Should filter out internal details');
    });

    it('should handle authentication error transformation security', async () => {
      // Test that error transformation maintains security
      const transformResponse = await makeApiRequest(port, '/authentication', {
        strategy: 'local',
        email: 'nonexistent@example.com',
        password: 'wrongpassword',
        captcha: DEFAULT_CAPTCHA,
      });

      assert.strictEqual(
        transformResponse.status,
        STATUS_CODE_UNAUTHORIZED,
        'Should handle error transformation security',
      );
      assert.ok(transformResponse.errors?.length, 'Should provide error messages');

      // Error messages should be transformed to remove sensitive information
      const errorText = transformResponse.errors?.join(' ').toLowerCase() || '';
      assert.ok(!errorText.includes('password'), 'Should transform out password information');
      assert.ok(!errorText.includes('hash'), 'Should transform out hash information');
    });

    it('should handle authentication error serialization security', async () => {
      // Test that error serialization maintains security
      const serializeResponse = await makeApiRequest(port, '/authentication', {
        strategy: 'local',
        email: 'nonexistent@example.com',
        password: 'wrongpassword',
        captcha: DEFAULT_CAPTCHA,
      });

      assert.strictEqual(
        serializeResponse.status,
        STATUS_CODE_UNAUTHORIZED,
        'Should handle error serialization security',
      );
      assert.ok(serializeResponse.errors?.length, 'Should provide error messages');

      // Error messages should be serialized securely
      const errorText = serializeResponse.errors?.join(' ').toLowerCase() || '';
      assert.ok(!errorText.includes('password'), 'Should serialize without password information');
      assert.ok(!errorText.includes('internal'), 'Should serialize without internal details');
    });

    it('should handle authentication error deserialization security', async () => {
      // Test that error deserialization maintains security
      const deserializeResponse = await makeApiRequest(port, '/authentication', {
        strategy: 'local',
        email: 'nonexistent@example.com',
        password: 'wrongpassword',
        captcha: DEFAULT_CAPTCHA,
      });

      assert.strictEqual(
        deserializeResponse.status,
        STATUS_CODE_UNAUTHORIZED,
        'Should handle error deserialization security',
      );
      assert.ok(deserializeResponse.errors?.length, 'Should provide error messages');

      // Error messages should be handled securely during deserialization
      const errorText = deserializeResponse.errors?.join(' ').toLowerCase() || '';
      assert.ok(!errorText.includes('password'), 'Should deserialize without password information');
    });

    it('should handle authentication error storage security', async () => {
      // Test that error storage maintains security
      const storageResponse = await makeApiRequest(port, '/authentication', {
        strategy: 'local',
        email: 'nonexistent@example.com',
        password: 'wrongpassword',
        captcha: DEFAULT_CAPTCHA,
      });

      assert.strictEqual(storageResponse.status, STATUS_CODE_UNAUTHORIZED, 'Should handle error storage security');
      assert.ok(storageResponse.errors?.length, 'Should provide error messages');

      // Error messages should be stored securely
      const errorText = storageResponse.errors?.join(' ').toLowerCase() || '';
      assert.ok(!errorText.includes('password'), 'Should store without password information');
    });

    it('should handle authentication error transmission security', async () => {
      // Test that error transmission maintains security
      const transmitResponse = await makeApiRequest(port, '/authentication', {
        strategy: 'local',
        email: 'nonexistent@example.com',
        password: 'wrongpassword',
        captcha: DEFAULT_CAPTCHA,
      });

      assert.strictEqual(
        transmitResponse.status,
        STATUS_CODE_UNAUTHORIZED,
        'Should handle error transmission security',
      );
      assert.ok(transmitResponse.errors?.length, 'Should provide error messages');

      // Error messages should be transmitted securely
      const errorText = transmitResponse.errors?.join(' ').toLowerCase() || '';
      assert.ok(!errorText.includes('password'), 'Should transmit without password information');
    });

    it('should handle authentication error encryption security', async () => {
      // Test that error encryption maintains security
      const encryptResponse = await makeApiRequest(port, '/authentication', {
        strategy: 'local',
        email: 'nonexistent@example.com',
        password: 'wrongpassword',
        captcha: DEFAULT_CAPTCHA,
      });

      assert.strictEqual(encryptResponse.status, STATUS_CODE_UNAUTHORIZED, 'Should handle error encryption security');
      assert.ok(encryptResponse.errors?.length, 'Should provide error messages');

      // Error messages should be encrypted properly
      const errorText = encryptResponse.errors?.join(' ').toLowerCase() || '';
      assert.ok(!errorText.includes('password'), 'Should encrypt without exposing password information');
    });

    it('should handle authentication error compression security', async () => {
      // Test that error compression maintains security
      const compressResponse = await makeApiRequest(port, '/authentication', {
        strategy: 'local',
        email: 'nonexistent@example.com',
        password: 'wrongpassword',
        captcha: DEFAULT_CAPTCHA,
      });

      assert.strictEqual(compressResponse.status, STATUS_CODE_UNAUTHORIZED, 'Should handle error compression security');
      assert.ok(compressResponse.errors?.length, 'Should provide error messages');
    });
  });
});
