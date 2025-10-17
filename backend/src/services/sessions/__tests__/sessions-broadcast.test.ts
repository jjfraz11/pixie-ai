import { Application } from '@feathersjs/feathers';
import assert from 'assert';
import { getApp } from '../../../../src/app';
import { Params } from '@feathersjs/feathers';
import {
  setupTestEnvironment,
  teardownTestEnvironment,
  createTestUser,
  createTestSession,
  testContext,
  DEFAULT_PASSWORD_STRONG,
} from '../../../../src/test-utils';

// Define custom params interface for testing
interface TestParams extends Params {
  user?: {
    id: string;
    roles: string[];
  };
}

describe('broadcast sessions service', () => {
  let app: Application;
  let port: number;
  let userService: any;
  let sessionService: any;

  before(async () => {
    const setup = await setupTestEnvironment();
    port = setup.port;
    app = getApp();

    // Get service instances after server starts
    userService = app.service('users');
    sessionService = app.service('sessions');
  });

  after(async () => {
    const services = {
      users: userService,
      sessions: sessionService,
      participants: null,
    };
    await teardownTestEnvironment(services);
  });

  it('should create a broadcast session', async () => {
    // Create a test user for authentication
    const testUser = await createTestUser(userService, 'testbroadcast@example.com', DEFAULT_PASSWORD_STRONG, {
      roles: ['broadcaster'],
    });

    const session = await createTestSession(sessionService, 'BROADCAST', testUser, {
      title: 'My Broadcast',
      description: 'A test broadcast session',
      accessType: 'public',
    });

    assert.ok(session);
    assert.strictEqual(session.type, 'BROADCAST');
    assert.strictEqual(session.hostId, testUser.id);
    assert.strictEqual(session.maxParticipants, 1000);
  });

  it('should not allow non-broadcaster to create broadcast session', async () => {
    // Create a regular user (not broadcaster)
    const regularUser = await createTestUser(userService, 'regularuser@example.com', DEFAULT_PASSWORD_STRONG, {
      roles: ['user'],
    });

    try {
      await createTestSession(sessionService, 'BROADCAST', regularUser, {
        title: 'Another Broadcast',
        description: 'Should fail',
        accessType: 'public',
      });
      throw new Error('Expected Forbidden error');
    } catch (error: any) {
      assert.strictEqual(error.code, 403);
      assert.strictEqual(error.message, 'Only broadcasters can create broadcast sessions.');
    }
  });

  // Add more tests for:
  // - Getting broadcast sessions
  // - Updating broadcast sessions (host only)
  // - Deleting broadcast sessions (host only)
  // - Scalability validation (mock LiveKit responses)
});
