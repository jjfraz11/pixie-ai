import { assert } from 'chai';
describe('broadcast sessions service', () => {
    let app;
    let testUser;
    before(async () => {
        app = await getApp();
        // Create a test user for authentication
        testUser = await app.service('users').create({
            email: 'testbroadcast@example.com',
            password: 'Password123!',
            roles: ['broadcaster'],
        });
    });
    it('should create a broadcast session', async () => {
        const sessionData = {
            type: 'broadcast',
            title: 'My Broadcast',
            description: 'A test broadcast session',
            accessType: 'public',
        };
        const session = await app.service('sessions').create(sessionData, {
            authentication: { strategy: 'jwt', accessToken: 'some-token' }, // Mock authentication
            user: testUser,
        });
        assert.isNotNull(session);
        assert.equal(session.type, 'BROADCAST');
        assert.equal(session.hostId, testUser.id);
        assert.equal(session.maxParticipants, 1000);
    });
    it('should not allow non-broadcaster to create broadcast session', async () => {
        const regularUser = await app.service('users').create({
            email: 'regularuser@example.com',
            password: 'Password123!',
            roles: ['user'],
        });
        const sessionData = {
            type: 'broadcast',
            title: 'Another Broadcast',
            description: 'Should fail',
            accessType: 'public',
        };
        try {
            await app.service('sessions').create(sessionData, {
                authentication: { strategy: 'jwt', accessToken: 'some-token' },
                user: regularUser,
            });
            assert.fail('Expected Forbidden error');
        }
        catch (error) {
            assert.equal(error.code, 403);
            assert.equal(error.message, 'Only broadcasters can create broadcast sessions.');
        }
    });
    // Add more tests for:
    // - Getting broadcast sessions
    // - Updating broadcast sessions (host only)
    // - Deleting broadcast sessions (host only)
    // - Scalability validation (mock LiveKit responses)
});
