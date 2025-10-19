import { startServer } from '../server/api';
import axios from 'axios';
import { Server } from 'http';

export class ServerManager {
  private server: Server | null = null;
  private port: number;

  constructor(port: number = 3001) {
    this.port = port;
  }

  /**
   * Start the embedded API server
   */
  async start(): Promise<void> {
    // If already running, do nothing
    if (this.isRunning()) {
      console.log(`Server already running at ${this.getUrl()}`);
      return;
    }

    // Check if external server is running
    const externalRunning = await this.checkIfServerRunning();
    if (externalRunning) {
      console.log(`Server already running externally at ${this.getUrl()}`);
      return;
    }

    // Start new server
    this.server = startServer(this.port);

    // Wait for server to be ready
    await this.waitForServer();
    console.log(`Server started at ${this.getUrl()}`);
  }

  /**
   * Stop the server
   */
  async stop(): Promise<void> {
    if (!this.server) {
      return;
    }

    return new Promise((resolve, reject) => {
      this.server!.close((err) => {
        if (err) {
          reject(err);
        } else {
          this.server = null;
          console.log('Server stopped');
          resolve();
        }
      });
    });
  }

  /**
   * Check if server is running
   */
  isRunning(): boolean {
    return this.server !== null;
  }

  /**
   * Get server URL
   */
  getUrl(): string {
    return `http://localhost:${this.port}`;
  }

  /**
   * Check if a server is running on the port (external or our own)
   */
  async checkIfServerRunning(): Promise<boolean> {
    try {
      const response = await axios.get(`${this.getUrl()}/api/health`, {
        timeout: 1000
      });
      return response.status === 200;
    } catch (error) {
      // Expected error when server is not running (connection refused)
      if (axios.isAxiosError(error) && error.code === 'ECONNREFUSED') {
        return false;
      }
      // Log unexpected errors for debugging
      console.debug('Unexpected error checking server status:', error);
      return false;
    }
  }

  /**
   * Wait for server to become available
   */
  private async waitForServer(maxAttempts: number = 10): Promise<void> {
    for (let i = 0; i < maxAttempts; i++) {
      const running = await this.checkIfServerRunning();
      if (running) {
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error('Server failed to start');
  }
}
