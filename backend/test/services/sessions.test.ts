import assert from "assert";
import app from "../../src/app";
import { Server } from 'http';
import { AddressInfo } from 'net'; // Import AddressInfo

describe("'sessions' service", function () {
  this.timeout(5000);

  let server: Server;
  let port: number; // Declare port variable

  before(async function () {
    // Find an available port
    port = await new Promise<number>((resolve, reject) => {
      const s = require('net').createServer();
      s.once('error', reject);
      s.listen(0, () => {
        const address = s.address() as AddressInfo;
        s.close(() => resolve(address.port));
      });
    });

    try {
      server = await app.listen(port); // Use the dynamic port
    } catch (error: any) {
      console.error('Error starting server:', error.message);
      throw error;
    }
  });

  after(async function () {
    if (server) {
      await server.close();
    }
  });

  it("registered the service", () => {
    const service = app.service("sessions");
    assert.ok(service, "Registered the service");
  });

  it("creates a p2p session", async () => {
    const service = app.service("sessions");
    const sessionData = {
      type: "p2p",
      hostId: "test-user-id", // Add a test hostId
    };

    try {
      const session = await service.create(sessionData);
      assert.ok(session.id, "Session has an ID");
      assert.strictEqual(session.type, "p2p", "Session type is p2p");
    } catch (error) {
      console.error("Error creating session:", error);
      throw error;
    }
  });

  it("prevents non-broadcasters from creating broadcast sessions", async () => {
    const service = app.service("sessions");

    // Mock context with a user that doesn't have broadcaster role
    const mockContext = {
      params: {
        user: {
          id: "test-user-id",
          roles: ["viewer"], // Not a broadcaster
        },
      },
    };

    const sessionData = {
      type: "broadcast",
      hostId: "test-user-id",
    };

    try {
      // Try to create a broadcast session as a non-broadcaster
      await service.create(sessionData, mockContext.params);
      assert.fail("Should have thrown an error for non-broadcaster creating broadcast session");
    } catch (error) {
      assert.ok(error.message.includes("broadcaster"), "Error message should mention broadcaster role");
    }
  });

  it("allows broadcasters to create broadcast sessions", async () => {
    const service = app.service("sessions");

    // Mock context with a user that has broadcaster role
    const mockContext = {
      params: {
        user: {
          id: "broadcaster-user-id",
          roles: ["broadcaster"],
        },
      },
    };

    const sessionData = {
      type: "broadcast",
      hostId: "broadcaster-user-id",
    };

    try {
      const session = await service.create(sessionData, mockContext.params);
      assert.ok(session.id, "Session has an ID");
      assert.strictEqual(session.type, "broadcast", "Session type is broadcast");
    } catch (error) {
      console.error("Error creating broadcast session:", error);
      throw error;
    }
  });

  it("validates session type", async () => {
    const service = app.service("sessions");
    const invalidSessionData = {
      type: "invalid-type",
      hostId: "test-user-id",
    };

    try {
      await service.create(invalidSessionData);
      assert.fail("Should have thrown an error for invalid session type");
    } catch (error) {
      assert.ok(error.message.includes("Invalid session type"), "Error message should mention invalid type");
    }
  });
});
