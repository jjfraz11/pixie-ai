# Authentication Test Base Class

## Overview

The `AuthenticationTestBase` class provides a shared foundation for all authentication test files, eliminating repetitive setup code and providing consistent patterns for testing authentication scenarios.

## Features

- **Consistent Setup/Teardown**: Standardized initialization and cleanup across all test files
- **Reusable Test Data Creation**: Easy creation of users, sessions, and participants
- **Authentication Scenarios**: Built-in support for login, logout, and token validation
- **Error Testing Patterns**: Structured approach to testing authentication errors
- **Performance Monitoring**: Built-in performance tracking and caching
- **Comprehensive Resource Management**: Automatic cleanup and resource tracking

## Quick Start

### Basic Usage

```typescript
import { AuthenticationTestBase } from '@/test-utils/base/authentication-test-base';

describe('My Authentication Tests', () => {
  let testBase: AuthenticationTestBase;

  before(async () => {
    testBase = new AuthenticationTestBase({
      performanceMonitoring: true,
      isolation: true,
      debug: true,
    });
    await testBase.setup();
  });

  after(async () => {
    await testBase.teardown();
  });

  it('should test basic authentication', async () => {
    // Create test user
    const user = await testBase.createTestUser('test@example.com');

    // Login user
    await testBase.loginUser(user);

    // Make authenticated request
    const response = await testBase.makeAuthenticatedRequest(user, '/users');
    assert.strictEqual(response.status, 200);
  });
});
```

### Advanced Configuration

```typescript
const testBase = new AuthenticationTestBase({
  performanceMonitoring: true,
  isolation: true,
  isolationKey: 'my-custom-test-suite',
  autoRefresh: false,
  tokenCacheEnabled: true,
  port: 3030,
  defaultPassword: 'MySecurePassword123!',
  defaultUserCount: 5,
  debug: true,
  appFactory: () => getApp(), // Custom app factory if needed
});
```

## Common Patterns

### Creating Test Users

```typescript
// Single user
const user = await testBase.createTestUser('user@example.com', 'password', {
  roles: ['USER'],
});

// Multiple users
const users = await testBase.createTestUsers(3); // Creates admin, user, user

// Create scenario with multiple roles
const scenario = await testBase.createAuthenticationScenario(4);
// Access: scenario.adminUser, scenario.regularUser, scenario.broadcasterUser, scenario.multiRoleUser
```

### Authentication Flows

```typescript
// Login user
await testBase.loginUser(user);

// Logout user
await testBase.logoutUser(user);

// Validate token
const isValid = testBase.validateUserToken(user);

// Check if token needs refresh
const needsRefresh = testBase.shouldRefreshUserToken(user);

// Refresh token
await testBase.authHelper.refreshToken(user);
```

### Making Requests

```typescript
// Authenticated request
const response = await testBase.makeAuthenticatedRequest(user, '/users', {
  method: 'GET',
  headers: { 'Custom-Header': 'value' },
});

// Direct API call (for error testing)
const errorResponse = await fetch(`http://localhost:${testBase.getPort()}/authentication`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    strategy: 'local',
    email: 'invalid-email',
    password: 'wrong',
  }),
}).then((res) => res.json());
```

## Error Testing

### Structured Error Testing

```typescript
// Test authentication errors
await testBase.testAuthenticationError({
  errorType: 'authentication',
  expectedStatus: 401,
  expectedErrors: ['Invalid credentials'],
});

// Test validation errors
await testBase.testAuthenticationError({
  errorType: 'validation',
  expectedStatus: 400,
  errorData: { email: 'invalid-email' },
});

// Test authorization errors
await testBase.testAuthenticationError({
  errorType: 'authorization',
  expectedStatus: 403,
});

// Test security errors (XSS, injection, etc.)
await testBase.testAuthenticationError({
  errorType: 'security',
  expectedStatus: 400,
  errorData: { email: '<script>alert("xss")</script>@example.com' },
});
```

### Custom Error Scenarios

```typescript
// Test specific error conditions
const response = await fetch(`http://localhost:${testBase.getPort()}/authentication`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    strategy: 'local',
    email: 'test@example.com',
    password: 'wrong-password',
  }),
}).then((res) => res.json());

// Validate error response
assert.strictEqual(response.status, 401);
assert.ok(response.errors?.length, 'Should have error messages');
```

## Built-in Test Scenarios

### Successful Authentication Test

```typescript
await testBase.testSuccessfulAuthentication(user);
```

### Token Refresh Test

```typescript
await testBase.testTokenRefresh(user);
```

### Concurrent Authentication Test

```typescript
await testBase.testConcurrentAuthentication(5); // Test 5 concurrent users
```

### Password Reset Flow Test

```typescript
await testBase.testPasswordResetFlow(user);
```

## Performance and Monitoring

### Getting Performance Metrics

```typescript
// Get performance metrics
const metrics = testBase.getPerformanceMetrics();
console.log('Performance metrics:', metrics);

// Get cache statistics
const cacheStats = testBase.getCacheStats();
console.log('Cache stats:', cacheStats);

// Clear caches if needed
testBase.clearCaches();
```

### Debug Information

```typescript
// Enable debug logging
const testBase = new AuthenticationTestBase({ debug: true });

// Get authentication statistics
const authStats = testBase.getAuthStats();
console.log('Auth stats:', authStats);
```

## Migration Guide

### From Old Pattern

**Before:**

```typescript
let builder: TestServiceBuilder;
let authHelper: AuthenticationHelper;
let userService: any;

before(async () => {
  builder = await new TestServiceBuilder().withPerformanceMonitoring().withIsolation().build();

  const port = await builder.startServer(() => getApp());
  const app = getApp();
  userService = app.service('users');

  authHelper = new AuthenticationHelper({
    port,
    autoRefresh: false,
  });
});

after(async () => {
  await builder.cleanup();
});
```

**After:**

```typescript
let testBase: AuthenticationTestBase;

before(async () => {
  testBase = new AuthenticationTestBase({
    performanceMonitoring: true,
    isolation: true,
  });
  await testBase.setup();
});

after(async () => {
  await testBase.teardown();
});
```

## Best Practices

1. **Always call setup() and teardown()**: These methods handle all initialization and cleanup
2. **Use consistent configuration**: Define your test base configuration once and reuse it
3. **Leverage built-in scenarios**: Use the provided test methods for common scenarios
4. **Enable debug mode during development**: Helps with troubleshooting
5. **Use performance monitoring in CI**: Track test performance over time
6. **Clean up test data**: The base class handles this automatically, but be aware of it

## Error Handling

The base class provides comprehensive error handling:

```typescript
try {
  await testBase.testAuthenticationError({
    errorType: 'authentication',
    expectedStatus: 401,
  });
} catch (error) {
  // Test framework will handle assertion errors
  throw error;
}
```

## Integration with Existing Tests

The base class is designed to work alongside existing test utilities:

```typescript
// Use with existing factories
const user = await testBase.userFactory.createTestUser(userService, email, password);

// Use with existing scenarios
const scenario = await testBase.createAuthenticationScenario();

// Use existing constants
const response = await testBase.makeAuthenticatedRequest(user, '/users');
assert.strictEqual(response.status, STATUS_CODE_SUCCESS);
```

This base class significantly reduces boilerplate code while maintaining full compatibility with existing test infrastructure.
