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
          name: 'config',
          message: 'Domains config file:',
          default: 'domains.json'
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
          name: 'export',
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
    const args = this.buildArgs(options, tool.script);

    // Execute tool
    await this.executeTool(tool.script, args);
  }

  /**
   * Build command arguments from options
   * Maps to actual CLI flag names, not camelCase prompt names
   */
  private buildArgs(options: any, toolScript: string): string[] {
    const args: string[] = [];

    // Handle positional arguments first (selector needs domain as positional)
    if (toolScript === 'selector' && options.domain) {
      args.push(options.domain);
    }

    for (const [key, value] of Object.entries(options)) {
      // Skip positional args that were already added
      if (toolScript === 'selector' && key === 'domain') {
        continue;
      }

      // Check if this option has a negated flag in the CLI
      const negatedFlag = this.getNegatedFlag(key);

      if (value === true) {
        // For negated options (fetchAssets, useScheduler), true means use default (no flag)
        // For regular options, true means add the flag
        if (!negatedFlag) {
          const flagName = this.mapToCliFlag(key);
          args.push(`--${flagName}`);
        }
      } else if (value === false) {
        // For negated booleans, use the actual negated flag from CLI
        if (negatedFlag) {
          args.push(negatedFlag);
        }
      } else if (value) {
        // For non-boolean values, add flag with value
        const flagName = this.mapToCliFlag(key);
        args.push(`--${flagName}`, String(value));
      }
    }

    return args;
  }

  /**
   * Map camelCase prompt names to CLI flag names
   */
  private mapToCliFlag(key: string): string {
    // Convert camelCase to kebab-case for CLI flags
    return key.replace(/([A-Z])/g, '-$1').toLowerCase();
  }

  /**
   * Get the actual negated flag name for boolean options
   * Maps to actual CLI definitions (e.g., --no-fetch-assets, not --no-fetchAssets)
   */
  private getNegatedFlag(key: string): string | null {
    const negatedFlags: Record<string, string> = {
      'fetchAssets': '--no-fetch-assets',
      'useScheduler': '--no-scheduler'
    };
    return negatedFlags[key] || null;
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
