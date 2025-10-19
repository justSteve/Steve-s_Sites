import { BrowserLauncher } from '../BrowserLauncher';
import open from 'open';

// Mock the open package
jest.mock('open');

describe('BrowserLauncher', () => {
  let launcher: BrowserLauncher;

  beforeEach(() => {
    launcher = new BrowserLauncher();
    jest.clearAllMocks();
  });

  it('should open browser with provided URL', async () => {
    const mockOpen = open as jest.MockedFunction<typeof open>;
    mockOpen.mockResolvedValue(undefined as any);

    await launcher.open('http://localhost:3001');

    expect(mockOpen).toHaveBeenCalledWith('http://localhost:3001');
  });

  it('should handle errors gracefully', async () => {
    const mockOpen = open as jest.MockedFunction<typeof open>;
    mockOpen.mockRejectedValue(new Error('Browser not found'));

    // Should not throw
    await expect(launcher.open('http://localhost:3001')).resolves.not.toThrow();
  });
});
