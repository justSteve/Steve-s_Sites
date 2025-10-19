import { ServerManager } from '../ServerManager';
import axios from 'axios';

describe('ServerManager', () => {
  let manager: ServerManager;

  beforeEach(() => {
    manager = new ServerManager(3457);
  });

  afterEach(async () => {
    await manager.stop();
  });

  it('should start server and report running status', async () => {
    expect(manager.isRunning()).toBe(false);

    await manager.start();

    expect(manager.isRunning()).toBe(true);
    expect(manager.getUrl()).toBe('http://localhost:3457');
  });

  it('should detect if server is already running', async () => {
    await manager.start();

    // Try to start again
    await manager.start();

    // Should still be running on same instance
    expect(manager.isRunning()).toBe(true);
  });

  it('should stop server gracefully', async () => {
    await manager.start();
    expect(manager.isRunning()).toBe(true);

    await manager.stop();
    expect(manager.isRunning()).toBe(false);
  });

  it('should check if external server is running on port', async () => {
    const isRunning = await manager.checkIfServerRunning();
    expect(typeof isRunning).toBe('boolean');
  });
});
