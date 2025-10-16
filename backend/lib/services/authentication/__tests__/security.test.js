import { assert } from 'chai';
import { getApp } from '../../../../src/app';
describe('Authentication and Authorization Security Tests', () => {
    let app;
    let adminUser;
    let regularUser;
    before(async () => {
        app = await getApp();
        // Create an admin user
        adminUser = await app.service('users').create({
            email: 'admin-security@example.com',
            password: 'AdminPass123!',
            roles: ['admin'],
        });
        // Create a regular user
        regularUser = await app.service('users').create({
            email: 'user-security@example.com',
            password: 'UserPass123!',
            roles: ['user'],
        });
    });
    it('should prevent unauthorized access to admin-only endpoints', async () => {
        // Attempt to access an admin-only endpoint as a regular user
        // (Assuming there's an admin-only endpoint like /users for listing all users)
        try {
            await app.service('users').find({
                authentication: { strategy: 'jwt', accessToken: 'some-token' },
                user: regularUser,
            });
            assert.fail('Expected Forbidden error for regular user accessing admin endpoint');
        }
        catch (error) {
            assert.equal(error.code, 403);
            assert.equal(error.message, 'You are not allowed to access this resource.');
        }
    });
    it('should allow admin user to access admin-only endpoints', async () => {
        // Attempt to access an admin-only endpoint as an admin user
        const users = await app.service('users').find({
            authentication: { strategy: 'jwt', accessToken: 'some-token' },
            user: adminUser,
        });
        assert.isArray(users);
        assert.isAtLeast(users.length, 2); // At least admin and regular user
    });
    it('should prevent brute-force login attempts', async () => {
        const testEmail = `bruteforce-${Date.now()}@example.com`;
        await app.service('users').create({
            email: testEmail,
            password: 'BruteForcePass123!',
            roles: ['user'],
        });
        // Attempt multiple failed logins
        for (let i = 0; i < 6; i++) { // 5 attempts allowed, 6th should trigger rate limit
            try {
                await app.service('authentication').create({
                    strategy: 'local',
                    email: testEmail,
                    password: 'wrongpassword',
                    captcha: 'pixie',
                });
                if (i < 5) {
                    assert.fail('Expected authentication to fail for wrong password');
                }
            }
            catch (error) {
                if (i < 5) {
                    assert.equal(error.code, 401); // Unauthorized for wrong password
                }
                else {
                    assert.equal(error.code, 429); // Too Many Requests for rate limit
                    assert.include(error.message, 'Too many authentication attempts');
                }
            }
        }
    });
    // Add more security tests:
    // - Password reset token expiration and single-use
    // - XSS protection (verify sanitized input)
    // - SQL injection (verify parameterized queries or ORM protection)
    // - CORS validation
});
