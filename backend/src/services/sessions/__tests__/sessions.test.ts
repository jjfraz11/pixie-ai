import assert from 'assert';
import app from '../../../app';
import { Params } from '@feathersjs/feathers';
import {
  setupTestEnvironment,
  teardownTestEnvironment,
  createTestUser,
  createTestSession,
  testContext,
  DEFAULT_PASSWORD_STRONG,
} from '../../../test-utils';

// Define custom params interface for testing
interface TestParams extends Params {
  user?: {
    id: string;
    roles: string[];
  };
}

describe('Sessions Service', () => {
  let port: number;
  let userService: any;
  let sessionService: any;
  let testUsers: any[] = [];

  before(async () => {
    const setup = await setupTestEnvironment();
    port = setup.port;

    // Get service instances after server starts
    userService = app.service('users');
    sessionService = app.service('sessions');

    // Create shared test users for all tests
    const viewerUser = await createTestUser(userService, 'viewer-test@example.com', DEFAULT_PASSWORD_STRONG, {
      id: 'viewer-test-user-id',
      roles: ['USER'],
    });

    const broadcasterUser = await createTestUser(userService, 'broadcaster-test@example.com', DEFAULT_PASSWORD_STRONG, {
      id: 'broadcaster-test-user-id',
      roles: ['USER'],
    });

    testUsers = [viewerUser, broadcasterUser];
  });

  beforeEach(async () => {
    // Get fresh service instances for each test
    userService = app.service('users');
    sessionService = app.service('sessions');
  });

  afterEach(async () => {
    // Clean up any sessions created in individual tests
    if (sessionService) {
      const trackedSessions = testContext.getTracked('sessions');
      for (const session of trackedSessions) {
        try {
          await sessionService.remove(session.id);
          testContext.untrack('sessions', session.id);
        } catch (error) {
          console.error('Error cleaning up session:', error);
        }
      }
    }
  });

  after(async () => {
    const services = {
      users: userService,
      sessions: sessionService,
      participants: null, // We'll add if needed
    };
    await teardownTestEnvironment(services);
  });

  describe('Service Registration', () => {
    it("'sessions' service - registered the service", () => {
      assert.ok(sessionService, 'Sessions service should be available');
    });
  });

  describe('P2P Sessions', () => {
    let p2pSession: any;

    beforeEach(async () => {
      p2pSession = await createTestSession(sessionService, 'p2p', 'viewer-test-user-id');
      testContext.track('sessions', {
        id: p2pSession.id,
        type: 'session',
        data: p2pSession,
      });
    });

    it('should create a p2p session', async () => {
      assert.ok(p2pSession.id, 'Session has an ID');
      assert.strictEqual(p2pSession.type, 'P2P', 'Session type is P2P');
      assert.strictEqual(p2pSession.hostId, 'viewer-test-user-id', 'Session has correct hostId');
    });

    it('should patch a p2p session', async () => {
      const patchData = {
        type: 'p2p',
      };

      const [patchedSession] = await sessionService.patch(p2pSession.id, patchData, {
        user: {
          id: 'test-user-id',
          roles: ['viewer'],
        },
      } as TestParams);

      assert.strictEqual(patchedSession.id, p2pSession.id, 'Session ID should remain the same');
    });

    it('should remove a p2p session', async () => {
      const [removedSession] = await sessionService.remove(p2pSession.id, {
        user: {
          id: 'test-user-id',
          roles: ['viewer'],
        },
      } as TestParams);

      assert.strictEqual(removedSession.id, p2pSession.id, 'Removed session ID should match');
    });
  });

  describe('Broadcast Sessions', () => {
    let broadcastSession: any;

    beforeEach(async () => {
      broadcastSession = await createTestSession(sessionService, 'broadcast', 'test-user-id');
      testContext.track('sessions', {
        id: broadcastSession.id,
        type: 'session',
        data: broadcastSession,
      });
    });

    it('should create a broadcast session', async () => {
      assert.ok(broadcastSession.id, 'Session has an ID');
      assert.strictEqual(broadcastSession.type, 'BROADCAST', 'Session type is BROADCAST');
      assert.strictEqual(broadcastSession.hostId, 'test-user-id', 'Session has correct hostId');
    });

    it('should patch a broadcast session', async () => {
      const patchData = {
        type: 'broadcast',
      };

      const [patchedSession] = await sessionService.patch(broadcastSession.id, patchData, {
        user: {
          id: 'test-user-id',
          roles: ['viewer'],
        },
      } as TestParams);

      assert.strictEqual(patchedSession.id, broadcastSession.id, 'Session ID should remain the same');
    });

    it('should remove a broadcast session', async () => {
      const [removedSession] = await sessionService.remove(broadcastSession.id, {
        user: {
          id: 'test-user-id',
          roles: ['viewer'],
        },
      } as TestParams);

      assert.strictEqual(removedSession.id, broadcastSession.id, 'Removed session ID should match');
    });
  });

  describe('Viewer Sessions for Public Broadcast', () => {
    let publicBroadcastSession: any;

    before(async () => {
      // Create a public broadcast session
      publicBroadcastSession = await sessionService.create(
        {
          type: 'broadcast',
          accessType: 'PUBLIC',
          hostId: 'broadcaster-test-user-id',
          title: 'Public Broadcast Test',
        },
        {
          user: {
            id: 'broadcaster-test-user-id',
            roles: ['broadcaster'],
          },
        } as TestParams,
      );
      testContext.track('sessions', {
        id: publicBroadcastSession.id,
        type: 'session',
        data: publicBroadcastSession,
      });
    });

    it('should allow unauthenticated users to get a public broadcast session', async () => {
      const response = await makeApiRequest(port, `/sessions/${publicBroadcastSession.id}`);

      assert.strictEqual(response.status, 200);
      assert.strictEqual(response.data.id, publicBroadcastSession.id);
      assert.strictEqual(response.data.accessType, 'PUBLIC');
    });

    it('should allow authenticated users (viewer role) to get a public broadcast session', async () => {
      const viewerToken = await getAuthToken(port, 'viewer-test@example.com', DEFAULT_PASSWORD_STRONG);

      const response = await makeAuthenticatedApiRequest(port, `/sessions/${publicBroadcastSession.id}`, viewerToken);

      assert.strictEqual(response.status, 200);
      assert.strictEqual(response.data.id, publicBroadcastSession.id);
      assert.strictEqual(response.data.accessType, 'PUBLIC');
    });

    it('should not allow unauthenticated users to create a session', async () => {
      const response = await makeApiRequest(port, '/sessions', {
        type: 'broadcast',
        accessType: 'PUBLIC',
        hostId: 'some-id',
        title: 'Attempted Public Broadcast',
      });

      assert.strictEqual(response.status, 401);
    });

    it('should not allow unauthenticated users to patch a session', async () => {
      const response = await makeApiRequest(
        port,
        `/sessions/${publicBroadcastSession.id}`,
        { title: 'New Title' },
        'PATCH',
      );

      assert.strictEqual(response.status, 401);
    });

    it('should not allow unauthenticated users to remove a session', async () => {
      const response = await makeApiRequest(port, `/sessions/${publicBroadcastSession.id}`, {}, 'DELETE');

      assert.strictEqual(response.status, 401);
    });
  });
});
