import inquirer from 'inquirer';
import { spawn } from 'child_process';

interface ToolDefinition {
  name: string;
  script: string;
  description: string;
  prompts?: any[];
}

export class ToolRunner {
  private tools: ToolDefinition[] = [
    {
      name: 'CDX Analyzer',
      script: 'cdx-analyzer',
      description: 'Analyze CDX files and populate database',
      prompts: [
        {
          type: 'input',
          name: 'file',
          message: 'CDX file path:',
          default: 'snapshots.cdx'
        }
      ]
    },
    {
      name: 'Crawler',
      script: 'crawler',
      description: 'Wayback Machine crawler with asset fetching',
      prompts: [
        {
          type: 'input',
          name: 'snapshots',
          message: 'Snapshot list file:',
          default: 'selected_snapshots.txt'
        },
        {
          type: 'confirm',
          name: 'fetchAssets',
          message: 'Fetch assets (CSS, JS, images)?',
          default: true
        },
        {
          type: 'confirm',
          name: 'useScheduler',
          message: 'Use off-peak scheduler?',
          default: true
        }
      ]
    },
    {
      name: 'Selector',
      script: 'selector',
      description: 'Select snapshots based on criteria',
      prompts: [
        {
          type: 'input',
          name: 'domain',
          message: 'Domain to select:',
        },
        {
          type: 'input',
          name: 'output',
          message: 'Output file:',
          default: 'selected_snapshots.txt'
        }
      ]
    },
    {
      name: 'Generator',
      script: 'generator',
      description: 'Generate timeline and reports',
      prompts: [
        {
          type: 'input',
          name: 'domain',
          message: 'Domain to generate report for:',
        }
      ]
    }
  ];

  /**
   * Get list of available tools
   */
  getAvailableTools(): string[] {
    return this.tools.map(t => t.name);
  }

  /**
   * Run tool selection menu
   */
  async run(): Promise<void> {
    while (true) {
      const { tool } = await inquirer.prompt([
        {
          type: 'list',
          name: 'tool',
          message: 'Select a CLI tool to run:',
          choices: [
            ...this.tools.map(t => ({
              name: `${t.name} - ${t.description}`,
              value: t.name
            })),
            new inquirer.Separator(),
            { name: 'Back to Main Menu', value: 'back' }
          ]
        }
      ]);

      if (tool === 'back') {
        return;
      }

      const selectedTool = this.tools.find(t => t.name === tool);
      if (selectedTool) {
        await this.runTool(selectedTool);
      }
    }
  }

  /**
   * Run a specific tool with prompts
   */
  private async runTool(tool: ToolDefinition): Promise<void> {
    console.log(`\nRunning ${tool.name}...\n`);

    // Get tool-specific options
    let options: any = {};
    if (tool.prompts && tool.prompts.length > 0) {
      options = await inquirer.prompt(tool.prompts);
    }

    // Build command arguments
    const args = this.buildArgs(options);

    // Execute tool
    await this.executeTool(tool.script, args);
  }

  /**
   * Build command arguments from options
   */
  private buildArgs(options: any): string[] {
    const args: string[] = [];

    for (const [key, value] of Object.entries(options)) {
      if (value === true) {
        args.push(`--${key}`);
      } else if (value === false) {
        args.push(`--no-${key}`);
      } else if (value) {
        args.push(`--${key}`, String(value));
      }
    }

    return args;
  }

  /**
   * Execute tool as child process
   */
  private async executeTool(script: string, args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const child = spawn('npm', ['run', script, '--', ...args], {
        stdio: 'inherit',
        shell: true
      });

      child.on('close', (code) => {
        if (code === 0) {
          console.log(`\n${script} completed successfully`);
          resolve();
        } else {
          console.error(`\n${script} exited with code ${code}`);
          resolve(); // Don't reject, just return to menu
        }
      });

      child.on('error', (error) => {
        console.error(`Failed to execute ${script}:`, error.message);
        resolve();
      });
    });
  }
}
