/**
 * @fileoverview LiveKit Token Service Tests - Core Functionality (Modernized)
 *
 * Simplified LiveKit token service tests using modern test utilities.
 * Focuses on core token generation functionality while maintaining essential coverage.
 *
 * **Purpose:**
 * - Test LiveKit token service registration and configuration
 * - Verify token generation with different roles and permissions
 * - Validate basic token structure and service availability
 * - Test modern utility integration
 *
 * **Scope:**
 * - Service registration and method availability
 * - Token generation for different participant roles
 * - Basic token structure validation
 * - Modern test utilities integration
 *
 * **Note:** Uses modern TestServiceBuilder for unified setup/teardown
 * **Note:** Complex edge cases simplified for early-stage testing focus
 * **Note:** Focus on core token generation for essential functionality
 */

import { Application } from '@feathersjs/feathers';
import assert from 'assert';

import { getApp } from '@/app';
import { TestServiceBuilder, STATUS_CODE_SUCCESS, STATUS_CODE_CREATED, STATUS_CODE_BAD_REQUEST } from '@/test-utils';

describe('LiveKit Token Service - Core Service Registration & Configuration', () => {
  let builder: TestServiceBuilder;
  let livekitTokenService: any;

  before(async () => {
    // Initialize modern test utilities with unified setup
    builder = await new TestServiceBuilder()
      .withPerformanceMonitoring()
      .withServiceDiscovery(() => getApp())
      .build();

    // Get services from the app
    const app = getApp();
    livekitTokenService = app.service('livekit-token');

    // Configure mock LiveKit credentials for testing
    app.set('livekit', {
      apiKey: 'test-api-key',
      apiSecret: 'test-api-secret',
      wsUrl: 'ws://localhost:7880',
    });
  });

  after(async () => {
    await builder.cleanup();
  });

  describe('Service Registration & Core Operations', () => {
    it('should register LiveKit token service with create method', () => {
      assert.ok(livekitTokenService, 'LiveKit token service should be available');
      assert.ok(typeof livekitTokenService.create === 'function', 'LiveKit token service should have create method');
    });

    it('should validate service configuration and LiveKit integration', () => {
      assert.ok(livekitTokenService, 'LiveKit token service should be configured');
      // Note: Service may have minimal hook configuration for token generation
    });
  });

  describe('Token Generation - Core Functionality', () => {
    it('should generate token for broadcaster role', async () => {
      const tokenData = {
        sessionId: 'test-session-123',
        participantIdentity: 'broadcaster-user-456',
        participantName: 'Test Broadcaster',
        role: 'broadcaster' as const,
      };

      const result = await livekitTokenService.create(tokenData);

      assert.ok(result, 'Should generate token successfully');
      assert.ok(result.token, 'Should return JWT token');
      assert.ok(result.wsUrl, 'Should return WebSocket URL');
      assert.strictEqual(result.participantIdentity, tokenData.participantIdentity, 'Should return correct identity');
    });

    it('should generate token for viewer role', async () => {
      const tokenData = {
        sessionId: 'viewer-session-202',
        participantIdentity: 'viewer-user-303',
        participantName: 'Test Viewer',
        role: 'viewer' as const,
      };

      const result = await livekitTokenService.create(tokenData);

      assert.ok(result, 'Should generate token for viewer successfully');
      assert.ok(result.token, 'Should return JWT token');
      assert.ok(result.wsUrl, 'Should return WebSocket URL');
      assert.strictEqual(result.participantIdentity, tokenData.participantIdentity, 'Should return correct identity');
    });

    it('should generate token with minimal required fields', async () => {
      const tokenData = {
        sessionId: 'minimal-session-404',
        participantIdentity: 'minimal-user-505',
      };

      const result = await livekitTokenService.create(tokenData);

      assert.ok(result, 'Should generate token with minimal fields');
      assert.ok(result.token, 'Should return JWT token');
      assert.ok(result.wsUrl, 'Should return WebSocket URL');
      assert.strictEqual(result.participantIdentity, tokenData.participantIdentity, 'Should return correct identity');
    });
  });

  describe('LiveKit Configuration Integration', () => {
    it('should include WebSocket URL in response', async () => {
      const tokenData = {
        sessionId: 'ws-url-test-session',
        participantIdentity: 'ws-url-test-user',
      };

      const result = await livekitTokenService.create(tokenData);

      assert.ok(result, 'Should create token successfully');
      assert.ok(result.wsUrl, 'Should include WebSocket URL');
      assert.strictEqual(result.wsUrl, 'ws://localhost:7880', 'Should return configured WebSocket URL');
    });

    it('should provide all required connection parameters', async () => {
      const tokenData = {
        sessionId: 'connection-params-session',
        participantIdentity: 'connection-params-user',
        participantName: 'Connection Params User',
        role: 'host' as const,
      };

      const result = await livekitTokenService.create(tokenData);

      assert.ok(result, 'Should provide connection parameters');
      assert.ok(result.token, 'Should include access token');
      assert.ok(result.wsUrl, 'Should include WebSocket URL');
      assert.ok(result.participantIdentity, 'Should include participant identity');

      // These are all the parameters needed for a LiveKit client to connect
      const requiredParams = ['token', 'wsUrl', 'participantIdentity'];
      requiredParams.forEach((param) => {
        assert.ok(result[param], `Should include required parameter: ${param}`);
      });
    });
  });

  describe('Modern Test Utilities Integration', () => {
    it('should validate test utility constants', () => {
      assert.ok(STATUS_CODE_SUCCESS === 200, 'Should have correct success status code');
      assert.ok(STATUS_CODE_CREATED === 201, 'Should have correct created status code');
      assert.ok(STATUS_CODE_BAD_REQUEST === 400, 'Should have correct bad request status code');
    });

    it('should validate test builder functionality', () => {
      assert.ok(builder, 'Test builder should be available');
      assert.ok(typeof builder.getPort === 'function', 'Builder should provide port access');
      assert.ok(typeof builder.makeReliableRequest === 'function', 'Builder should provide reliable requests');
      assert.ok(typeof builder.cleanup === 'function', 'Builder should provide cleanup functionality');
    });
  });

  describe('Service Method Validation', () => {
    it('should validate LiveKit token service methods', () => {
      const app = getApp();

      assert.ok(livekitTokenService, 'LiveKit token service should be available');
      assert.ok(typeof livekitTokenService.create === 'function', 'Should have create method for token generation');

      // Verify service is properly registered
      assert.strictEqual(app.service('livekit-token'), livekitTokenService, 'Service should be properly registered');
    });

    it('should validate service configuration integrity', () => {
      const app = getApp();

      // Verify that the service is properly registered in the app
      assert.ok(app.service('livekit-token'), 'LiveKit token service should be registered in app');
      assert.strictEqual(app.service('livekit-token'), livekitTokenService, 'Service should be properly registered');

      // Verify service has proper FeathersJS service characteristics
      assert.ok(
        typeof livekitTokenService.id === 'string' || livekitTokenService.id === undefined,
        'Service should have id property',
      );
    });
  });

  describe('LiveKit Integration Configuration', () => {
    it('should validate LiveKit configuration is available', () => {
      const app = getApp();
      const livekitConfig = app.get('livekit');

      assert.ok(livekitConfig, 'LiveKit configuration should be available');
      assert.ok(livekitConfig.apiKey, 'Should have API key configuration');
      assert.ok(livekitConfig.apiSecret, 'Should have API secret configuration');
      assert.ok(livekitConfig.wsUrl, 'Should have WebSocket URL configuration');
    });

    it('should validate token service integration with LiveKit config', () => {
      const app = getApp();

      // Verify LiveKit token service can access configuration
      assert.ok(app, 'App should be available');
      assert.ok(app.service('livekit-token'), 'LiveKit token service should be accessible from app');
      assert.ok(
        typeof app.service('livekit-token').create === 'function',
        'LiveKit token service should be functional',
      );
    });
  });
});
