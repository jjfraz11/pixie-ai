import { createServer } from 'net';
import { disconnectPrisma } from './prisma';
import app from './app';
import assert from 'assert';
/**
 * Test context that tracks created objects for cleanup
 */
export class TestContext {
  constructor() {
    this.trackedObjects = {
      users: [],
      sessions: [],
      participants: [],
    };
  }
  /**
   * Track an object for cleanup
   */
  track(type, object) {
    if (!this.trackedObjects[type]) {
      this.trackedObjects[type] = [];
    }
    this.trackedObjects[type].push(object);
    return object;
  }
  /**
   * Track multiple objects of the same type
   */
  trackMany(type, objects) {
    objects.forEach((obj) => this.track(type, obj));
    return objects;
  }
  /**
   * Get all tracked objects of a specific type
   */
  getTracked(type) {
    return this.trackedObjects[type] || [];
  }
  /**
   * Get all tracked objects
   */
  getAllTracked() {
    return { ...this.trackedObjects };
  }
  /**
   * Remove object from tracking (when it's been cleaned up elsewhere)
   */
  untrack(type, id) {
    if (this.trackedObjects[type]) {
      this.trackedObjects[type] = this.trackedObjects[type].filter((obj) => obj.id !== id);
    }
  }
  /**
   * Clear all tracked objects of a specific type
   */
  clearTracked(type) {
    if (this.trackedObjects[type]) {
      this.trackedObjects[type] = [];
    }
  }
  /**
   * Set server instance
   */
  setServer(server, port) {
    this.server = server;
    this.port = port;
  }
  /**
   * Get server port
   */
  getPort() {
    return this.port;
  }
  /**
   * Start test server
   */
  async startServer() {
    this.port = await new Promise((resolve, reject) => {
      const s = createServer();
      s.once('error', reject);
      s.listen(0, () => {
        const address = s.address();
        s.close(() => resolve(address.port));
      });
    });
    try {
      this.server = await app.listen(this.port);
      return this.port;
    } catch (error) {
      console.error('Error starting server:', error.message);
      throw error;
    }
  }
  /**
   * Stop test server
   */
  async stopServer() {
    if (this.server) {
      this.server.close();
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  /**
   * Clean up a specific object
   */
  async cleanupObject(type, id, service) {
    if (!service || !id) {
      console.warn(`Skipping cleanup of ${type} ${id}: service or id is missing`);
      return;
    }
    try {
      await service.remove(id);
      this.untrack(type, id);
    } catch (error) {
      // Don't throw error during cleanup - just log it
      console.error(`Error cleaning up ${type} ${id}:`, error);
    }
  }
  /**
   * Clean up all tracked objects of a specific type
   */
  async cleanupTracked(type, service) {
    const objects = this.getTracked(type);
    // Clean up in reverse order to handle foreign key constraints
    for (const obj of objects.reverse()) {
      await this.cleanupObject(type, obj.id, service);
    }
    this.clearTracked(type);
  }
  /**
   * Clean up all tracked objects
   */
  async cleanupAll(services) {
    // Clean up in order to handle foreign key constraints
    const cleanupOrder = ['participants', 'sessions', 'users'];
    for (const type of cleanupOrder) {
      if (this.trackedObjects[type] && services && services[type]) {
        try {
          await this.cleanupTracked(type, services[type]);
        } catch (error) {
          console.error(`Error during cleanup of ${type}:`, error);
        }
      }
    }
  }
  /**
   * Complete cleanup - stops server and cleans up all objects
   */
  async teardown(services) {
    await this.stopServer();
    await this.cleanupAll(services);
    await disconnectPrisma();
  }
  /**
   * Clear all tracked objects - useful for test isolation
   */
  clearAllTracked() {
    this.trackedObjects = {
      users: [],
      sessions: [],
      participants: [],
    };
  }
  /**
   * Ensure clean test state - clears tracked objects and optionally cleans up existing data
   */
  async ensureCleanState(services) {
    this.clearAllTracked();
    if (services) {
      await this.cleanupAll(services);
    }
  }
}
/**
 * Global test context instance
 */
export const testContext = new TestContext();
/**
 * Setup function for tests - starts server and tracks objects
 */
export async function setupTestEnvironment() {
  const port = await testContext.startServer();
  return { port, context: testContext };
}
/**
 * Teardown function for tests - stops server and cleans up
 */
export async function teardownTestEnvironment(services) {
  await testContext.teardown(services);
}
/**
 * Helper function to create and track a test user
 */
export async function createTestUser(userService, email, password = 'TestPassword123!@#', additionalData = {}) {
  try {
    // First, try to find an existing user with this email
    const existingUsers = await userService.find({ query: { email } });
    if (existingUsers && existingUsers.data && existingUsers.data.length > 0) {
      const existingUser = existingUsers.data[0];
      // Track the existing user for cleanup
      console.log(`Reusing existing user ${email} with ID ${existingUser.id}`);
      return testContext.track('users', {
        id: existingUser.id,
        type: 'user',
        data: existingUser,
      });
    }
  } catch (error) {
    // If find fails, continue with creation
    console.warn(`Could not check for existing user ${email}, will create new:`, error);
  }
  // Create new user if none exists
  const { role, ...otherData } = additionalData;
  const user = await userService.create({
    email,
    password,
    roles: [role || 'USER'],
    ...otherData,
  });
  return testContext.track('users', {
    id: user.id,
    type: 'user',
    data: user,
  });
}
/**
 * Helper function to create and track a test session
 */
export async function createTestSession(sessionService, type, hostId, additionalData = {}) {
  const session = await sessionService.create({
    type,
    hostId,
    ...additionalData,
  });
  return testContext.track('sessions', {
    id: session.id,
    type: 'session',
    data: session,
  });
}
/**
 * Helper function to create and track a test participant
 */
export async function createTestParticipant(participantService, sessionId, userId, additionalData = {}) {
  const participant = await participantService.create({
    sessionId,
    userId,
    ...additionalData,
  });
  return testContext.track('participants', {
    id: participant.id,
    type: 'participant',
    data: participant,
  });
}
/**
 * Helper function to make authenticated requests
 */
export async function makeAuthenticatedRequest(method, url, token, data) {
  const headers = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return fetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
  });
}
/**
 * Helper function to make API requests with consistent error handling
 * Returns an object with either 'data' for success or 'errors' array for failures
 */
export async function makeApiRequest(port, endpoint, body, options = {}) {
  const { headers = {}, timeout = 5000 } = options;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    const response = await fetch(`http://localhost:${port}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return await handleResponse(response);
  } catch (error) {
    if (error.name === 'AbortError') {
      return { errors: [`Request timeout after ${timeout}ms`] };
    }
    return { errors: [`Network error: ${error.message}`] };
  }
}
/**
 * Helper function to make authenticated API requests
 */
export async function makeAuthenticatedApiRequest(port, endpoint, token, body, options = {}) {
  return makeApiRequest(port, endpoint, body, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${token}`,
    },
  });
}
/**
 * Handle different response scenarios and return consistent format
 */
async function handleResponse(response) {
  const { status } = response;
  try {
    const text = await response.text();
    let data;
    // Handle empty responses
    if (!text.trim()) {
      data = null;
    } else {
      try {
        data = JSON.parse(text);
      } catch (parseError) {
        return {
          errors: [`Invalid JSON response: ${text.substring(0, 100)}...`],
          status,
        };
      }
    }
    // Handle error status codes
    if (status >= 400) {
      const errorMessages = [];
      if (data && typeof data === 'object') {
        // Handle structured error responses
        if (data.message) {
          errorMessages.push(`${status}: ${data.message}`);
        } else if (data.error) {
          errorMessages.push(`${status}: ${data.error}`);
        } else if (data.code && data.message) {
          errorMessages.push(`${data.code}: ${data.message}`);
        } else {
          errorMessages.push(`${status}: ${JSON.stringify(data)}`);
        }
      } else {
        errorMessages.push(`${status}: ${text || 'Unknown error'}`);
      }
      return { errors: errorMessages, status };
    }
    // Success response
    return { data, status };
  } catch (error) {
    return {
      errors: [`Failed to process response: ${error.message}`],
      status,
    };
  }
}
/**
 * Helper function to get authentication token for a user
 */
export async function getAuthToken(port, email, password = 'TestPassword123!') {
  const response = await makeAuthenticatedRequest('POST', `http://localhost:${port}/authentication`, undefined, {
    strategy: 'local',
    email,
    password,
  });
  if (response.status !== 201) {
    throw new Error(`Authentication failed: ${response.status}`);
  }
  const data = await response.json();
  return data.accessToken;
}
/**
 * Constants for common status codes
 */
export const STATUS_CODE_REQUEST_SUCCESSFUL = 200;
export const STATUS_CODE_REQUEST_FAILED = 500;
/**
 * Constants for frequently reused test data
 */
export const DEFAULT_PASSWORD_STRONG = 'TestPassword123!@#';
export const DEFAULT_PASSWORD_WEAK = 'weak';
/**
 * Helper function to assert successful response
 */
export function assertSuccessResponse(response, expectedStatusCode = STATUS_CODE_REQUEST_SUCCESSFUL) {
  assert.strictEqual(response.status, expectedStatusCode);
  assert.strictEqual(response.errors, undefined);
  assert.ok(response.data, 'Response should have data');
}
/**
 * Helper function to assert failed response
 */
export function assertFailureResponse(response, expectedStatusCode = STATUS_CODE_REQUEST_FAILED) {
  assert.strictEqual(response.status, expectedStatusCode);
  assert.ok(response.errors, 'Response should have errors');
  assert.ok(Array.isArray(response.errors), 'Errors should be an array');
  assert.ok(response.errors.length > 0, 'Errors array should not be empty');
}
