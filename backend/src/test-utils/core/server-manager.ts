import { Server } from 'http';
import { AddressInfo } from 'net';
import * as net from 'node:net';

/**
 * HTTP server management for test utilities
 */
export class ServerManager {
  private server?: Server;
  private port?: number;

  /**
   * Set server instance
   */
  setServer(server: Server, port: number): void {
    this.server = server;
    this.port = port;
  }

  /**
   * Get server port
   */
  getPort(): number | undefined {
    return this.port;
  }

  /**
   * Start test server
   */
  async startServer(appFactory?: () => any): Promise<number> {
    this.port = await new Promise<number>((resolve, reject) => {
      const tempServer = net.createServer();
      tempServer.once('error', reject);
      tempServer.listen(0, () => {
        const address = tempServer.address() as AddressInfo;
        tempServer.close(() => resolve(address.port));
      });
    });

    try {
      let app: any;
      if (appFactory) {
        app = appFactory();
      } else {
        // Fallback: create a simple Express-like app
        app = {
          listen: async (port: number) => {
            const server = new Server();
            await new Promise<void>((resolve) => {
              server.listen(port, resolve);
            });
            return server;
          },
        };
      }

      this.server = await app.listen(this.port);
      return this.port;
    } catch (error: any) {
      console.error('Error starting server:', error.message);
      throw error;
    }
  }
  /**
   * Stop test server
   */
  async stopServer(): Promise<void> {
    if (this.server) {
      // Handle both HTTP Server instances and Express apps
      if (typeof this.server.close === 'function') {
        this.server.close();
      } else if (this.server && (this.server as any).listen) {
        // For Express apps, we need to close the underlying server
        const server = this.server as any;
        if (server._server && typeof server._server.close === 'function') {
          server._server.close();
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
      this.server = undefined;
      // Note: We keep the port for reference after stopping
    }
  }

  /**
   * Check if server is running
   */
  isRunning(): boolean {
    return this.server !== undefined && this.port !== undefined;
  }

  /**
   * Get server instance
   */
  getServer(): Server | undefined {
    return this.server;
  }
}

/**
 * Global server manager instance
 */
export const serverManager = new ServerManager();
