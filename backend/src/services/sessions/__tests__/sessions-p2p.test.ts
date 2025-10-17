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

describe('P2P sessions service', () => {
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

  it('should create a P2P session', async () => {
    // Create a test user for authentication
    const testUser = await createTestUser(userService, 'testp2p@example.com', DEFAULT_PASSWORD_STRONG, {
      roles: ['user'],
    });

    const session = await createTestSession(sessionService, 'P2P', testUser, {
      title: 'My P2P Chat',
      description: 'A test P2P session',
      accessType: 'public',
    });

    assert.ok(session);
    assert.strictEqual(session.type, 'P2P');
    assert.strictEqual(session.hostId, testUser.id);
    assert.strictEqual(session.maxParticipants, 10);
  });

  it('should create a private P2P session with password', async () => {
    // Create a test user for authentication
    const testUser = await createTestUser(userService, 'testp2p-private@example.com', DEFAULT_PASSWORD_STRONG, {
      roles: ['user'],
    });

    const session = await createTestSession(sessionService, 'P2P', testUser, {
      title: 'Private P2P Chat',
      description: 'A private test P2P session',
      accessType: 'private',
      password: 'privatepass',
    });

    assert.ok(session);
    assert.strictEqual(session.type, 'P2P');
    assert.strictEqual(session.accessType, 'PRIVATE');
    assert.strictEqual(session.hostId, testUser.id);
  });

  // Add more tests for:
  // - Getting P2P sessions
  // - Joining P2P sessions (with and without password)
  // - Leaving P2P sessions
  // - Participant limits
});
