import { ServerManager } from '../ServerManager';
import { BrowserLauncher } from '../BrowserLauncher';
import axios from 'axios';

describe('Interactive Menu Integration', () => {
  let serverManager: ServerManager;

  beforeEach(() => {
    serverManager = new ServerManager(3458);
  });

  afterEach(async () => {
    await serverManager.stop();
  });

  it('should start server and make it accessible', async () => {
    await serverManager.start();

    const response = await axios.get(`${serverManager.getUrl()}/api/health`);

    expect(response.status).toBe(200);
    expect(response.data.status).toBe('ok');
  });

  it('should handle server lifecycle correctly', async () => {
    // Start
    await serverManager.start();
    expect(serverManager.isRunning()).toBe(true);

    // Verify accessible
    const running = await serverManager.checkIfServerRunning();
    expect(running).toBe(true);

    // Stop
    await serverManager.stop();
    expect(serverManager.isRunning()).toBe(false);
  });

  it('should create all required components', () => {
    const launcher = new BrowserLauncher();

    expect(serverManager).toBeDefined();
    expect(launcher).toBeDefined();
  });
});
