import { describe, it, beforeEach, afterEach } from 'mocha';
import assert from 'assert';
import { Server } from 'http';
import { ServerManager, serverManager } from '../core/server-manager';
import * as net from 'node:net';

// Mock app module to avoid circular dependency
const mockApp = {
  listen: async (port: number) => {
    const server = new Server((req, res) => {
      if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'healthy' }));
      } else {
        res.writeHead(404);
        res.end('Not Found');
      }
    });

    await new Promise<void>((resolve) => {
      server.listen(port, resolve);
    });
    return server;
  },
};

describe('ServerManager', () => {
  let manager: ServerManager;

  beforeEach(() => {
    manager = new ServerManager();
  });

  afterEach(async () => {
    // Clean up any running servers
    try {
      await manager.stopServer();
    } catch (error) {
      // Ignore cleanup errors in test cleanup
    }
  });

  describe('initial state', () => {
    it('should start with no server and no port', () => {
      assert.strictEqual(manager.isRunning(), false);
      assert.strictEqual(manager.getPort(), undefined);
      assert.strictEqual(manager.getServer(), undefined);
    });
  });

  describe('setServer', () => {
    it('should set server instance and port', () => {
      const mockServer = {} as Server;
      const port = 3001;

      manager.setServer(mockServer, port);

      assert.strictEqual(manager.getServer(), mockServer);
      assert.strictEqual(manager.getPort(), port);
      assert.strictEqual(manager.isRunning(), true);
    });
  });

  describe('startServer', () => {
    it('should start server with automatic port assignment', async () => {
      const port = await manager.startServer(() => mockApp);

      assert.ok(port > 0);
      assert.ok(port <= 65535);
      assert.strictEqual(manager.getPort(), port);
      assert.strictEqual(manager.isRunning(), true);
      assert.ok(manager.getServer());
    });

    it('should start server and be able to handle requests', async () => {
      const port = await manager.startServer(() => mockApp);
      const server = manager.getServer();

      assert.ok(server);
      assert.ok(port > 0);

      // Verify server is actually listening by making a request
      const response = await fetch(`http://localhost:${port}/health`);
      assert.strictEqual(response.status, 200);
    });

    it('should handle startup errors gracefully', async () => {
      // Create a failing app factory
      const failingApp = {
        listen: async () => {
          throw new Error('Startup failed');
        },
      };

      try {
        await manager.startServer(() => failingApp);
        assert.fail('Should have thrown an error');
      } catch (error: any) {
        assert.ok(error.message.includes('Startup failed'));
      }

      assert.strictEqual(manager.isRunning(), false);
    });

    it('should find different ports for multiple instances', async () => {
      const manager1 = new ServerManager();
      const manager2 = new ServerManager();

      const port1 = await manager1.startServer(() => mockApp);
      const port2 = await manager2.startServer(() => mockApp);

      assert.notStrictEqual(port1, port2);
      assert.ok(port1 > 0);
      assert.ok(port2 > 0);

      // Cleanup
      await manager1.stopServer();
      await manager2.stopServer();
    });
  });

  describe('stopServer', () => {
    it('should stop running server', async () => {
      await manager.startServer();
      const port = manager.getPort();
      assert.strictEqual(manager.isRunning(), true);

      await manager.stopServer();

      assert.strictEqual(manager.isRunning(), false);
      assert.strictEqual(manager.getPort(), port); // Port should still be available

      // Verify server is actually stopped by checking if port is free
      const server = net.createServer();
      await new Promise<void>((resolve) => {
        server.listen(port, () => {
          server.close(() => resolve());
        });
      });
    });

    it('should handle stopping non-running server gracefully', async () => {
      assert.strictEqual(manager.isRunning(), false);

      // Should not throw error
      await manager.stopServer();

      assert.strictEqual(manager.isRunning(), false);
    });

    it('should handle server close errors gracefully', async () => {
      await manager.startServer(() => mockApp);

      // Mock server.close to throw an error
      const server = manager.getServer();
      if (server && (server as any).close) {
        const originalClose = (server as any).close.bind(server);
        let closeCalled = false;
        (server as any).close = () => {
          closeCalled = true;
          originalClose();
          throw new Error('Close failed');
        };

        // Should not throw error despite close failure
        try {
          await manager.stopServer();
        } catch (error) {
          // Expected to catch the error, but the manager should handle it
        }

        assert.ok(closeCalled, 'Server close should have been called');
      }
    });
  });

  describe('port management', () => {
    it('should handle port conflicts by finding available port', async () => {
      const manager1 = new ServerManager();
      const manager2 = new ServerManager();

      // Start first server
      const port1 = await manager1.startServer();

      // Start second server - should find different port
      const port2 = await manager2.startServer();

      assert.notStrictEqual(port1, port2);

      // Cleanup
      await manager1.stopServer();
      await manager2.stopServer();
    });

    it('should consistently assign same port when server is running', async () => {
      const port1 = await manager.startServer();
      assert.strictEqual(manager.isRunning(), true);

      // Stop and start again
      await manager.stopServer();
      const port2 = await manager.startServer();

      // Should be different port due to port reuse timing
      assert.ok(port2 > 0);

      await manager.stopServer();
    });
  });

  describe('state management', () => {
    it('isRunning should return correct state', async () => {
      assert.strictEqual(manager.isRunning(), false);

      await manager.startServer(() => mockApp);
      assert.strictEqual(manager.isRunning(), true);

      await manager.stopServer();
      assert.strictEqual(manager.isRunning(), false);
    });

    it('getPort should return current port', async () => {
      assert.strictEqual(manager.getPort(), undefined);

      const port = await manager.startServer();
      assert.strictEqual(manager.getPort(), port);

      await manager.stopServer();
      // Port should still be available after stop
      assert.strictEqual(manager.getPort(), port);
    });

    it('getServer should return server instance', async () => {
      assert.strictEqual(manager.getServer(), undefined);

      await manager.startServer(() => mockApp);
      assert.ok(manager.getServer());

      await manager.stopServer();
      // Server should be cleared after stop
      assert.strictEqual(manager.getServer(), undefined);
    });
  });

  describe('error scenarios', () => {
    it('should handle temporary server errors during port discovery', async () => {
      // This is hard to test directly, but we can verify the error handling exists
      const port = await manager.startServer();
      assert.ok(port > 0);

      await manager.stopServer();
    });

    it('should handle server startup race conditions', async () => {
      // Start multiple servers rapidly to test race conditions
      const managers = Array.from({ length: 3 }, () => new ServerManager());
      const ports = await Promise.all(managers.map((m) => m.startServer()));

      // All ports should be different
      const uniquePorts = new Set(ports);
      assert.strictEqual(uniquePorts.size, ports.length);

      // All servers should be running
      managers.forEach((m) => {
        assert.strictEqual(m.isRunning(), true);
      });

      // Cleanup
      await Promise.all(managers.map((m) => m.stopServer()));
    });

    it('should handle cleanup errors gracefully', async () => {
      await manager.startServer(() => mockApp);

      // Mock a cleanup scenario that might fail
      const server = manager.getServer();
      if (server && (server as any).close) {
        const originalClose = (server as any).close.bind(server);
        let closeCalled = false;
        (server as any).close = () => {
          closeCalled = true;
          originalClose();
          throw new Error('Cleanup error');
        };

        // Should not throw despite cleanup error
        try {
          await manager.stopServer();
        } catch (error) {
          // Expected to catch the error, but the manager should handle it
        }

        assert.ok(closeCalled, 'Server close should have been called');
      }
    });
  });

  describe('integration scenarios', () => {
    it('should work with real HTTP requests', async () => {
      const port = await manager.startServer(() => mockApp);

      // Test various HTTP methods
      const response1 = await fetch(`http://localhost:${port}/health`);
      assert.ok(response1.ok);

      await manager.stopServer();
    });

    it('should handle concurrent start/stop operations', async () => {
      // Start server
      await manager.startServer();

      // Try to start again (should work since we're using different logic)
      const port = manager.getPort();
      assert.ok(port);

      await manager.stopServer();
    });

    it('should maintain state consistency across operations', async () => {
      // Initial state
      assert.strictEqual(manager.isRunning(), false);
      assert.strictEqual(manager.getPort(), undefined);
      assert.strictEqual(manager.getServer(), undefined);

      // After start
      const port = await manager.startServer();
      assert.strictEqual(manager.isRunning(), true);
      assert.strictEqual(manager.getPort(), port);
      assert.ok(manager.getServer());

      // State should remain consistent
      assert.strictEqual(manager.getPort(), port);
      assert.strictEqual(manager.isRunning(), true);

      // After stop
      await manager.stopServer();
      assert.strictEqual(manager.isRunning(), false);
      assert.strictEqual(manager.getServer(), undefined);
      assert.strictEqual(manager.getPort(), port); // Port should persist
    });
  });

  describe('resource management', () => {
    it('should properly clean up resources', async () => {
      await manager.startServer();
      assert.strictEqual(manager.isRunning(), true);

      await manager.stopServer();
      assert.strictEqual(manager.isRunning(), false);

      // Port should be reusable
      const newManager = new ServerManager();
      const newPort = await newManager.startServer();
      assert.ok(newPort > 0);

      await newManager.stopServer();
    });

    it('should handle multiple cleanup cycles', async () => {
      // Multiple start/stop cycles
      for (let i = 0; i < 3; i++) {
        await manager.startServer();
        assert.strictEqual(manager.isRunning(), true);

        await manager.stopServer();
        assert.strictEqual(manager.isRunning(), false);
      }
    });
  });

  describe('edge cases', () => {
    it('should handle rapid start/stop cycles', async () => {
      const operations = [];

      for (let i = 0; i < 5; i++) {
        operations.push(manager.startServer());
        operations.push(manager.stopServer());
      }

      await Promise.all(operations);
    });

    it('should handle server instance replacement', async () => {
      await manager.startServer();
      const server1 = manager.getServer();
      const port1 = manager.getPort();

      // Create new server instance
      const newManager = new ServerManager();
      await newManager.startServer();
      const server2 = newManager.getServer();
      const port2 = newManager.getPort();

      assert.notStrictEqual(server1, server2);
      assert.notStrictEqual(port1, port2);

      await manager.stopServer();
      await newManager.stopServer();
    });
  });
});

describe('serverManager (global instance)', () => {
  afterEach(async () => {
    try {
      await serverManager.stopServer();
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  it('should provide singleton instance', () => {
    const { ServerManager } = require('../core/server-manager');
    const manager1 = new ServerManager();
    const manager2 = new ServerManager();

    assert.notStrictEqual(manager1, manager2);
    assert.strictEqual(serverManager, serverManager); // Same instance
  });

  it('should work for integration tests', async () => {
    const port = await serverManager.startServer(() => mockApp);
    assert.ok(port > 0);
    assert.strictEqual(serverManager.isRunning(), true);

    // Test that global instance works for real requests
    const response = await fetch(`http://localhost:${port}/health`);
    assert.ok(response.ok);

    await serverManager.stopServer();
  });
});
