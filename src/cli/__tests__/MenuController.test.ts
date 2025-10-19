import { MenuController } from '../MenuController';
import inquirer from 'inquirer';

jest.mock('inquirer');
jest.mock('../ServerManager');
jest.mock('../BrowserLauncher');
jest.mock('../ToolRunner');

describe('MenuController', () => {
  let controller: MenuController;
  let mockExit: jest.SpyInstance;

  beforeEach(() => {
    controller = new MenuController();
    jest.clearAllMocks();
    // Mock process.exit to prevent actual exit during tests
    mockExit = jest.spyOn(process, 'exit').mockImplementation(((code?: string | number | null | undefined) => {
      throw new Error(`process.exit: ${code}`);
    }) as any);
  });

  afterEach(() => {
    mockExit.mockRestore();
  });

  it('should display main menu options', async () => {
    const mockPrompt = inquirer.prompt as jest.MockedFunction<typeof inquirer.prompt>;
    mockPrompt.mockResolvedValue({ action: 'exit' });

    try {
      await controller.start();
    } catch (e: any) {
      // Expected to throw due to process.exit mock
      expect(e.message).toBe('process.exit: 0');
    }

    expect(mockPrompt).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'list',
          name: 'action'
        })
      ])
    );
  });

  it('should handle exit gracefully', async () => {
    const mockPrompt = inquirer.prompt as jest.MockedFunction<typeof inquirer.prompt>;
    mockPrompt.mockResolvedValue({ action: 'exit' });

    try {
      await controller.start();
    } catch (e: any) {
      // Expected to throw due to process.exit mock
      expect(e.message).toBe('process.exit: 0');
    }

    expect(mockExit).toHaveBeenCalledWith(0);
  });
});
