import { assert } from 'chai';
import { getApp } from '../../../../src/app';
describe('P2P sessions service', () => {
    let app;
    let testUser;
    before(async () => {
        app = await getApp();
        // Create a test user for authentication
        testUser = await app.service('users').create({
            email: 'testp2p@example.com',
            password: 'Password123!',
            roles: ['user'],
        });
    });
    it('should create a P2P session', async () => {
        const sessionData = {
            type: 'p2p',
            title: 'My P2P Chat',
            description: 'A test P2P session',
            accessType: 'public',
        };
        const session = await app.service('sessions').create(sessionData, {
            authentication: { strategy: 'jwt', accessToken: 'some-token' }, // Mock authentication
            user: testUser,
        });
        assert.isNotNull(session);
        assert.equal(session.type, 'P2P');
        assert.equal(session.hostId, testUser.id);
        assert.equal(session.maxParticipants, 10);
    });
    it('should create a private P2P session with password', async () => {
        const sessionData = {
            type: 'p2p',
            title: 'Private P2P Chat',
            description: 'A private test P2P session',
            accessType: 'private',
            password: 'privatepass',
        };
        const session = await app.service('sessions').create(sessionData, {
            authentication: { strategy: 'jwt', accessToken: 'some-token' },
            user: testUser,
        });
        assert.isNotNull(session);
        assert.equal(session.type, 'P2P');
        assert.equal(session.accessType, 'PRIVATE');
        assert.equal(session.hostId, testUser.id);
    });
    // Add more tests for:
    // - Getting P2P sessions
    // - Joining P2P sessions (with and without password)
    // - Leaving P2P sessions
    // - Participant limits
});
