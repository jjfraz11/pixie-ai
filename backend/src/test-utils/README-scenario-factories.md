# Scenario Factories and Enhanced API Helpers

This document provides comprehensive usage examples and migration guide for the new scenario factories and enhanced API helpers in the test-utils module.

## Overview

The scenario factories and enhanced API helpers provide powerful abstractions for creating complex test scenarios and making reliable API requests with built-in retry logic and comprehensive error handling.

## Scenario Factories

### Basic Usage

#### Authentication Scenario

```typescript
import { createAuthScenario, AuthScenario } from '../test-utils';

describe('Authentication Tests', () => {
  let scenario: AuthScenario;

  beforeEach(async () => {
    scenario = await createAuthScenario(userService, {
      userCount: 3,
      userRoles: ['USER', 'ADMIN'],
      makeUnique: true,
    });
  });

  afterEach(async () => {
    await scenario.cleanup();
  });

  it('should authenticate multiple users', async () => {
    const { users } = scenario;

    // Test authentication for each user
    for (const user of users) {
      const response = await makeAuthenticatedApiRequest(testPort, '/api/auth/login', user.token, {
        email: user.email,
        password: 'TestPassword123!@#',
      });

      expect(response.status).toBe(200);
      expect(response.data).toBeDefined();
    }
  });
});
```

#### Broadcast Scenario

```typescript
import { createBroadcastScenario, BroadcastScenario } from '../test-utils';

describe('Broadcast Session Tests', () => {
  let scenario: BroadcastScenario;

  beforeEach(async () => {
    scenario = await createBroadcastScenario(userService, sessionService, participantService, {
      userCount: 5,
      sessionCount: 2,
      participantsPerSession: 3,
      makeUnique: true,
    });
  });

  afterEach(async () => {
    await scenario.cleanup();
  });

  it('should create broadcast sessions with participants', async () => {
    const { sessions, participants } = scenario;

    // Verify sessions were created
    expect(sessions).toHaveLength(2);
    expect(sessions.every((s) => s.type === 'BROADCAST')).toBe(true);

    // Verify participants were added
    expect(participants.length).toBeGreaterThan(0);

    // Test session functionality
    for (const session of sessions) {
      const response = await makeApiRequest(testPort, `/api/sessions/${session.id}`);
      expect(response.status).toBe(200);
    }
  });
});
```

#### P2P Scenario

```typescript
import { createP2PScenario, P2PScenario } from '../test-utils';

describe('P2P Session Tests', () => {
  let scenario: P2PScenario;

  beforeEach(async () => {
    scenario = await createP2PScenario(userService, sessionService, participantService, {
      userCount: 4,
      sessionCount: 1,
      participantsPerSession: 3,
      makeUnique: true,
    });
  });

  afterEach(async () => {
    await scenario.cleanup();
  });

  it('should create P2P sessions correctly', async () => {
    const { sessions, participants } = scenario;

    expect(sessions).toHaveLength(1);
    expect(sessions[0].type).toBe('P2P');
    expect(participants.length).toBe(3); // host + 3 participants
  });
});
```

#### Mixed Scenario

```typescript
import { createMixedScenario } from '../test-utils';

describe('Mixed Session Tests', () => {
  let scenario: BroadcastScenario & P2PScenario;

  beforeEach(async () => {
    scenario = await createMixedScenario(userService, sessionService, participantService, {
      userCount: 8,
      broadcastCount: 2,
      p2pCount: 1,
      participantsPerSession: 2,
      makeUnique: true,
    });
  });

  afterEach(async () => {
    await scenario.cleanup();
  });

  it('should handle multiple session types', async () => {
    const { sessions } = scenario;

    const broadcastSessions = sessions.filter((s) => s.type === 'BROADCAST');
    const p2pSessions = sessions.filter((s) => s.type === 'P2P');

    expect(broadcastSessions).toHaveLength(2);
    expect(p2pSessions).toHaveLength(1);
  });
});
```

### Advanced Configuration

#### Custom Scenario Configuration

```typescript
const scenario = await createBroadcastScenario(userService, sessionService, participantService, {
  userCount: 10,
  sessionCount: 3,
  participantsPerSession: 5,
  userRoles: ['USER', 'BROADCASTER', 'MODERATOR'],
  additionalUserData: {
    profile: {
      displayName: 'Test User',
      avatar: 'default-avatar.png',
    },
  },
  additionalSessionData: {
    isPrivate: false,
    maxParticipants: 50,
    settings: {
      allowRecording: true,
      allowChat: true,
    },
  },
  additionalParticipantData: {
    joinedAt: new Date(),
    permissions: ['view', 'chat'],
  },
  makeUnique: true,
});
```

## Enhanced API Helpers

### Basic Usage

#### Reliable API Request

```typescript
import { makeReliableApiRequest } from '../test-utils';

describe('API Reliability Tests', () => {
  it('should retry on transient failures', async () => {
    const response = await makeReliableApiRequest(
      testPort,
      '/api/unstable-endpoint',
      { data: 'test' },
      {
        retryConfig: {
          maxRetries: 3,
          baseDelay: 1000,
          maxDelay: 5000,
        },
      },
    );

    expect(response.requestId).toBeDefined();
    expect(response.metrics).toBeDefined();
    expect(response.metrics.retryCount).toBeLessThanOrEqual(3);

    if (response.data) {
      expect(response.status).toBe(200);
    } else {
      expect(response.errors).toBeDefined();
      expect(response.status).toBeGreaterThanOrEqual(400);
    }
  });
});
```

#### Authenticated Reliable Request

```typescript
import { makeAuthenticatedReliableRequest } from '../test-utils';

describe('Authenticated API Tests', () => {
  it('should make authenticated requests with retry', async () => {
    const user = await createTestUser(userService, 'test@example.com');
    const token = await getAuthToken(testPort, user.email, 'TestPassword123!@#');

    const response = await makeAuthenticatedReliableRequest(testPort, '/api/protected-endpoint', token, {
      action: 'test',
    });

    expect(response.requestId).toBeDefined();
    expect(response.metrics.duration).toBeDefined();
  });
});
```

#### Bulk Requests

```typescript
import { makeBulkReliableRequests } from '../test-utils';

describe('Bulk API Tests', () => {
  it('should handle multiple requests efficiently', async () => {
    const requests = [
      {
        port: testPort,
        endpoint: '/api/endpoint1',
        body: { id: 1 },
      },
      {
        port: testPort,
        endpoint: '/api/endpoint2',
        token: userToken,
        body: { id: 2 },
      },
      {
        port: testPort,
        endpoint: '/api/endpoint3',
        body: { id: 3 },
        options: {
          retryConfig: {
            maxRetries: 5,
          },
        },
      },
    ];

    const responses = await makeBulkReliableRequests(requests);

    expect(responses).toHaveLength(3);
    responses.forEach((response) => {
      expect(response.requestId).toBeDefined();
      expect(response.metrics).toBeDefined();
    });
  });
});
```

#### Request with Validation

```typescript
import { makeReliableRequestWithValidation } from '../test-utils';

// Define custom validator
const userResponseValidator = (response): response is ApiResponse & { data: { id: string; email: string } } => {
  return response.data && typeof response.data.id === 'string' && typeof response.data.email === 'string';
};

describe('Validated API Tests', () => {
  it('should validate response structure', async () => {
    const response = await makeReliableRequestWithValidation(testPort, '/api/users/123', userResponseValidator);

    if (response) {
      // TypeScript knows this is a valid user response
      expect(response.data.id).toBe('123');
      expect(response.data.email).toContain('@');
      expect(response.metrics).toBeDefined();
    } else {
      // Handle case where validation failed
      expect(response).toBeNull();
    }
  });
});
```

### Error Handling and Debugging

#### Enhanced Error Context

```typescript
import { enhancedApiClient, EnhancedErrorContext } from '../test-utils';

describe('Error Debugging Tests', () => {
  it('should provide detailed error context', async () => {
    try {
      await enhancedApiClient.makeReliableApiRequest(testPort, '/api/failing-endpoint');
    } catch (error) {
      const errorContext: EnhancedErrorContext = enhancedApiClient.createEnhancedErrorContext(
        error,
        '/api/failing-endpoint',
        'POST',
        { startTime: Date.now(), retryCount: 2 },
        {
          statusCode: 500,
          requestHeaders: { 'Content-Type': 'application/json' },
          responseBody: { error: 'Internal Server Error' },
        },
      );

      enhancedApiClient.logEnhancedError(errorContext);

      // Use error context for debugging
      expect(errorContext.endpoint).toBe('/api/failing-endpoint');
      expect(errorContext.retryCount).toBe(2);
      expect(errorContext.debugInfo?.stackTrace).toBeDefined();
    }
  });
});
```

## Migration Guide

### From Basic Factories to Scenario Factories

#### Before (Basic Factory)

```typescript
// Old approach
const user1 = await createTestUser(userService, 'user1@example.com');
const user2 = await createTestUser(userService, 'user2@example.com');
const session = await createTestSession(sessionService, SessionType.BROADCAST, user1);
const participant = await createTestParticipant(participantService, session.id, user2.id);

// Manual cleanup
await userService.remove(user1.id);
await userService.remove(user2.id);
await sessionService.remove(session.id);
await participantService.remove(participant.id);
```

#### After (Scenario Factory)

```typescript
// New approach
const scenario = await createBroadcastScenario(userService, sessionService, participantService, {
  userCount: 2,
  sessionCount: 1,
  participantsPerSession: 1,
});

// Use scenario objects
const { users, sessions, participants } = scenario;

// Automatic cleanup
await scenario.cleanup();
```

### From Basic API Calls to Enhanced API Helpers

#### Before (Basic API Call)

```typescript
// Old approach
const response = await makeApiRequest(testPort, '/api/endpoint', { data: 'test' });
if (response.errors) {
  console.error('Request failed:', response.errors);
}
```

#### After (Enhanced API Helper)

```typescript
// New approach
const response = await makeReliableApiRequest(
  testPort,
  '/api/endpoint',
  { data: 'test' },
  {
    retryConfig: {
      maxRetries: 3,
      baseDelay: 1000,
    },
  },
);

// Enhanced error handling and metrics
if (response.errors) {
  console.error(`Request ${response.requestId} failed after ${response.metrics.duration}ms:`, response.errors);
} else {
  console.log(`Request ${response.requestId} succeeded in ${response.metrics.duration}ms`);
}
```

## Best Practices

### Scenario Factories

1. **Always cleanup**: Use the cleanup method to ensure proper resource management
2. **Use unique scenarios**: Set `makeUnique: true` for tests that run in parallel
3. **Configure appropriately**: Adjust user/session counts based on test requirements
4. **Leverage relationships**: Use the pre-established relationships between users, sessions, and participants

### Enhanced API Helpers

1. **Configure retry logic**: Adjust retry settings based on endpoint reliability
2. **Monitor metrics**: Use request metrics for performance analysis
3. **Handle errors gracefully**: Use enhanced error context for better debugging
4. **Validate responses**: Use custom validators for type-safe responses

### Performance Considerations

1. **Cache usage**: Scenario factories automatically leverage existing caching mechanisms
2. **Bulk operations**: Use bulk request methods for multiple operations
3. **Connection reuse**: Maintain server connections when possible
4. **Resource limits**: Be mindful of memory usage with large scenarios

## Troubleshooting

### Common Issues

#### Scenario Creation Fails

```typescript
// Check scenario integrity
const scenario = await createBroadcastScenario(userService, sessionService, participantService);
console.log('Scenario stats:', {
  users: scenario.users.length,
  sessions: scenario.sessions.length,
  participants: scenario.participants.length,
});
```

#### API Request Timeouts

```typescript
// Adjust timeout and retry configuration
const response = await makeReliableApiRequest(testPort, '/api/slow-endpoint', data, {
  timeout: 30000, // 30 seconds
  retryConfig: {
    maxRetries: 5,
    baseDelay: 2000,
    maxDelay: 10000,
  },
});
```

#### Memory Leaks

```typescript
// Always cleanup scenarios
afterEach(async () => {
  if (scenario) {
    await scenario.cleanup();
  }
});
```

This comprehensive guide should help you effectively use the new scenario factories and enhanced API helpers in your test suite. The new utilities provide significant improvements in test reliability, maintainability, and debugging capabilities.
