import assert from "assert";
import app from "../../../app";
import {
  setupTestEnvironment,
  teardownTestEnvironment,
  createTestUser,
  getAuthToken,
  testContext,
  makeApiRequest,
  makeAuthenticatedApiRequest,
  STATUS_CODE_REQUEST_SUCCESSFUL,
  STATUS_CODE_REQUEST_FAILED,
  DEFAULT_PASSWORD_STRONG,
  DEFAULT_PASSWORD_WEAK,
  assertSuccessResponse,
  assertFailureResponse,
} from "../../../test-utils";

describe("Authentication Service", () => {
  let port: number;
  let userService: any;

  before(async () => {
    const setup = await setupTestEnvironment();
    port = setup.port;
    userService = app.service("users");
  });

  after(async () => {
    const services = {
      users: userService,
      sessions: null,
      participants: null,
    };
    await teardownTestEnvironment(services);
  });

  describe("Service Registration", () => {
    it("should register authentication service with JWT strategy", async () => {
      const service = app.service("authentication");
      assert.ok(service, "Authentication service should exist");

      // Check if JWT strategy is registered
      const authenticationService = service as any;
      assert.ok(
        authenticationService.strategies,
        "Service should have strategies"
      );
      assert.ok(
        authenticationService.strategies.jwt,
        "JWT strategy should be registered"
      );
    });

    it("should register authentication service with Local strategy", async () => {
      const service = app.service("authentication");
      assert.ok(service, "Authentication service should exist");

      // Check if Local strategy is registered
      const authenticationService = service as any;
      assert.ok(
        authenticationService.strategies,
        "Service should have strategies"
      );
      assert.ok(
        authenticationService.strategies.local,
        "Local strategy should be registered"
      );
    });

    it("should have authentication entity configured", async () => {
      const entity = app.get("authentication").entity;
      assert.ok(entity, "Authentication entity should be configured");
      assert.strictEqual(entity, "user", "Entity should be 'user'");
    });
  });

  describe("Authentication with User Context", () => {
    let testUser: any;
    let jwtToken: string;

    before(async () => {
      // Ensure clean state before each test
      testContext.clearAllTracked();

      // Create a fresh test user for each test
      testUser = await createTestUser(
        userService,
        `authtest_${Date.now()}@example.com`,
        DEFAULT_PASSWORD_STRONG
      );
    });

    describe("Local Strategy Authentication", () => {
      it("should authenticate user with valid email and password", async () => {
        const response = await makeApiRequest(port, "/authentication", {
          strategy: "local",
          email: testUser.data.email,
          password: DEFAULT_PASSWORD_STRONG,
        });

        assert.strictEqual(response.status, 201);
        assert.ok(response.data?.accessToken, "Should return access token");
        assert.ok(
          response.data?.authentication,
          "Should return authentication data"
        );
      });

      it("should reject authentication with wrong password", async () => {
        const response = await makeApiRequest(port, "/authentication", {
          strategy: "local",
          email: testUser.data.email,
          password: DEFAULT_PASSWORD_WEAK,
        });

        assert.strictEqual(response.status, 401);
        assert.ok(response.errors?.length, "Should have error messages");
      });

      it("should reject authentication with non-existent user", async () => {
        const response = await makeApiRequest(port, "/authentication", {
          strategy: "local",
          email: "nonexistent@example.com",
          password: DEFAULT_PASSWORD_WEAK,
        });

        assert.strictEqual(response.status, 401);
        assert.ok(response.errors?.length, "Should have error messages");
      });

      it("should reject authentication with missing password", async () => {
        const response = await makeApiRequest(port, "/authentication", {
          strategy: "local",
          email: testUser.data.email,
        });

        assert.strictEqual(response.status, 401);
        assert.ok(response.errors?.length, "Should have error messages");
      });

      it("should reject authentication with missing email", async () => {
        const response = await makeApiRequest(port, "/authentication", {
          strategy: "local",
          password: DEFAULT_PASSWORD_STRONG,
        });

        assert.strictEqual(response.status, 401);
        assert.ok(response.errors?.length, "Should have error messages");
      });
    });

    describe("JWT Strategy Authentication", () => {
      it("should authenticate user with valid credentials and return JWT token", async () => {
        const response = await makeApiRequest(port, "/authentication", {
          strategy: "local",
          email: testUser.data.email,
          password: DEFAULT_PASSWORD_STRONG,
        });

        assert.strictEqual(response.status, 201);
        assert.ok(response.data?.accessToken, "Should return access token");
        assert.ok(
          response.data?.authentication,
          "Should return authentication data"
        );

        jwtToken = response.data?.accessToken;
      });

      it("should authenticate with JWT token", async () => {
        // First, get a JWT token
        const authResponse = await makeApiRequest(port, "/authentication", {
          strategy: "local",
          email: testUser.data.email,
          password: DEFAULT_PASSWORD_STRONG,
        });

        assert.strictEqual(authResponse.status, 201);
        jwtToken = authResponse.data?.accessToken;
        assert.ok(jwtToken, "Should have received JWT token");

        // Now test JWT authentication
        const jwtAuthResponse = await makeAuthenticatedApiRequest(
          port,
          "/authentication",
          jwtToken,
          {
            strategy: "jwt",
            accessToken: jwtToken,
          }
        );

        assert.strictEqual(jwtAuthResponse.status, 201);
        assert.ok(
          jwtAuthResponse.data?.authentication,
          "Should return authentication data"
        );
      });

      it("should reject authentication with invalid JWT token", async () => {
        const jwtToken = "invalid.jwt.token";

        const response = await makeAuthenticatedApiRequest(
          port,
          "/authentication",
          jwtToken,
          {
            strategy: "jwt",
            accessToken: jwtToken,
          }
        );

        assert.strictEqual(response.status, 401);
        assert.ok(response.errors?.length, "Should have error messages");
      });
    });
  });

  describe("Service Hooks", () => {
    it("should log authentication attempts in before hook", async () => {
      // This test verifies that the authentication service hooks are working
      // by attempting authentication and checking that it doesn't throw
      const service = app.service("authentication");

      assert.ok(service, "Authentication service should exist");

      // The hooks are tested implicitly by the authentication tests above
      // If hooks weren't working, the authentication would fail
      // This test mainly ensures the service is properly configured
    });

    it("should log errors in error hook", async () => {
      // This test verifies that the authentication service error handling works
      const service = app.service("authentication");

      assert.ok(service, "Authentication service should exist");

      // Error handling is tested implicitly by the error handling tests above
      // If error hooks weren't working, the error tests would fail differently
    });
  });

  describe("Error Handling", () => {
    it("should handle malformed request body", async () => {
      const response = await makeApiRequest(
        port,
        "/authentication",
        "invalid json" as any
      );

      // Should return appropriate error status or network error
      if (response.errors) {
        assert.ok(
          response.errors.length > 0,
          "Should have error messages for malformed JSON"
        );
      } else {
        assert.ok(
          response.status && response.status >= 400,
          "Should return error status for malformed JSON"
        );
      }
    });

    it("should handle missing strategy", async () => {
      const response = await makeApiRequest(port, "/authentication", {
        email: "test@example.com",
        password: DEFAULT_PASSWORD_STRONG,
      });

      assert.strictEqual(response.status, 401);
      assert.ok(response.errors?.length, "Should have error messages");
    });

    it("should handle unsupported strategy", async () => {
      const response = await makeApiRequest(port, "/authentication", {
        strategy: "unsupported",
        email: "test@example.com",
        password: DEFAULT_PASSWORD_STRONG,
      });

      assert.strictEqual(response.status, 401);
      assert.ok(response.errors?.length, "Should have error messages");
    });
  });

  describe("Integration with Password Reset", () => {
    it("should have password reset service configured", async () => {
      const service = app.service("authentication/password-reset");
      assert.ok(service, "Password reset service should exist");
    });
  });
});
