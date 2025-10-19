import { ToolRunner } from '../ToolRunner';
import inquirer from 'inquirer';
import { spawn } from 'child_process';

jest.mock('inquirer');
jest.mock('child_process');

describe('ToolRunner', () => {
  let runner: ToolRunner;

  beforeEach(() => {
    runner = new ToolRunner();
    jest.clearAllMocks();
  });

  it('should list available tools', () => {
    const tools = runner.getAvailableTools();

    expect(tools).toContain('CDX Analyzer');
    expect(tools).toContain('Crawler');
    expect(tools).toContain('Selector');
    expect(tools).toContain('Generator');
  });

  it('should prompt for tool selection', async () => {
    const mockPrompt = inquirer.prompt as jest.MockedFunction<typeof inquirer.prompt>;
    mockPrompt.mockResolvedValue({ tool: 'back' });

    await runner.run();

    expect(mockPrompt).toHaveBeenCalled();
  });
});
