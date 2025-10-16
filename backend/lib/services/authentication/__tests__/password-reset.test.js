import assert from 'assert';
import app from '../../../app';
import {
  setupTestEnvironment,
  teardownTestEnvironment,
  createTestUser,
  makeApiRequest,
  DEFAULT_PASSWORD_STRONG,
} from '../../../test-utils';
describe('Password Reset Service', () => {
  let port;
  let userService;
  before(async () => {
    const setup = await setupTestEnvironment();
    port = setup.port;
    userService = app.service('users');
  });
  after(async () => {
    const services = {
      users: userService,
      sessions: null,
      participants: null,
    };
    await teardownTestEnvironment(services);
  });
  describe('Password Reset Request (No User Context)', () => {
    it('should return success message for non-existing user (no information leakage)', async () => {
      const response = await makeApiRequest(port, '/authentication/password-reset', {
        action: 'request',
        email: 'nonexistent@example.com',
      });
      assert.strictEqual(response.status, 201);
      assert.ok(response.data?.success);
      assert.strictEqual(
        response.data?.message,
        'If an account with that email exists, a password reset email has been sent.',
      );
    });
    it('should return error for invalid email format', async () => {
      const response = await makeApiRequest(port, '/authentication/password-reset', {
        action: 'request',
        email: 'invalid-email',
      });
      assert.strictEqual(response.status, 400);
      assert.ok(response.errors?.length, 'Should have error messages');
      assert.ok(
        response.errors?.some((error) => error.includes('400')),
        'Should return 400 for invalid email format',
      );
    });
    it('should rate limit password reset requests', async () => {
      const email = 'ratelimit@example.com';
      // Make multiple requests to trigger rate limiting
      for (let i = 0; i < 6; i++) {
        await makeApiRequest(port, '/authentication/password-reset', {
          action: 'request',
          email,
        });
      }
      const response = await makeApiRequest(port, '/authentication/password-reset', {
        action: 'request',
        email,
      });
      assert.strictEqual(response.status, 400);
      assert.ok(response.errors?.length, 'Should have error messages');
      assert.ok(
        response.errors?.some((error) => error.includes('400')),
        'Should return 400 for rate limiting',
      );
    });
  });
  describe('Password Reset with Valid User', () => {
    let testUser;
    let resetToken;
    before(async () => {
      // Create a fresh test user for password reset testing
      testUser = await createTestUser(userService, `passwordreset_${Date.now()}@example.com`, DEFAULT_PASSWORD_STRONG);
      // Generate a valid reset token for the user
      resetToken = 'valid-reset-token';
      const resetTokenExpires = new Date(Date.now() + 3600000); // 1 hour from now
      await userService.patch(testUser.id, {
        resetToken: resetToken,
        resetTokenExpires: resetTokenExpires,
      });
    });
    it('should request password reset for existing user', async () => {
      const response = await makeApiRequest(port, '/authentication/password-reset', {
        action: 'request',
        email: testUser.data.email,
      });
      assert.strictEqual(response.status, 201);
      assert.ok(response.data?.success);
      assert.strictEqual(
        response.data?.message,
        'If an account with that email exists, a password reset email has been sent.',
      );
    });
    it('should change password with valid token and strong password', async () => {
      const response = await makeApiRequest(port, '/authentication/password-reset', {
        action: 'change',
        token: resetToken,
        newPassword: 'NewStrongPassword123!',
      });
      assert.strictEqual(response.status, 201);
      assert.ok(response.data?.success);
      assert.strictEqual(response.data?.message, 'Password changed successfully');
      // Verify password was changed
      const updatedUser = await userService.get(testUser.id);
      assert.ok(updatedUser.password !== testUser.password);
      assert.ok(updatedUser.resetToken === null);
      assert.ok(updatedUser.resetTokenExpires === null);
      console.log(JSON.stringify({ testUser, response, updatedUser }, null, 2));
    });
    it('should return error for password too short', async () => {
      const response = await makeApiRequest(port, '/authentication/password-reset', {
        action: 'change',
        token: resetToken,
        newPassword: 'short',
      });
      assert.strictEqual(response.status, 400);
      assert.ok(response.errors?.length, 'Should have error messages');
      assert.ok(
        response.errors?.some((error) => error.includes('400')),
        'Should return 400 for password too short',
      );
    });
    it('should return error for password without complexity requirements', async () => {
      const response = await makeApiRequest(port, '/authentication/password-reset', {
        action: 'change',
        token: resetToken,
        newPassword: 'weakpassword',
      });
      assert.strictEqual(response.status, 400);
      assert.ok(response.errors?.length, 'Should have error messages');
      assert.ok(
        response.errors?.some((error) => error.includes('400')),
        'Should return 400 for password complexity requirements',
      );
    });
  });
  describe('Password Reset with Invalid Tokens', () => {
    it('should return error for invalid token', async () => {
      const response = await makeApiRequest(port, '/authentication/password-reset', {
        action: 'change',
        token: 'invalid-token',
        newPassword: 'NewStrongPassword123!',
      });
      assert.strictEqual(response.status, 400);
      assert.ok(response.errors?.length, 'Should have error messages');
      assert.ok(
        response.errors?.some((error) => error.includes('400')),
        'Should return 400 for invalid token',
      );
    });
    it('should return error for expired token', async () => {
      // Create a test user with an expired token
      const testUser = await createTestUser(userService, `expired_${Date.now()}@example.com`, DEFAULT_PASSWORD_STRONG);
      const expiredToken = 'expired-reset-token';
      const expiredTokenExpires = new Date(Date.now() - 3600000); // 1 hour ago
      await userService.patch(testUser.id, {
        resetToken: expiredToken,
        resetTokenExpires: expiredTokenExpires,
      });
      const response = await makeApiRequest(port, '/authentication/password-reset', {
        action: 'change',
        token: expiredToken,
        newPassword: 'NewStrongPassword123!',
      });
      assert.strictEqual(response.status, 400);
      assert.ok(response.errors?.length, 'Should have error messages');
      assert.ok(
        response.errors?.some((error) => error.includes('400')),
        'Should return 400 for expired token',
      );
    });
  });
});
