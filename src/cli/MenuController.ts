import inquirer from 'inquirer';
import { ServerManager } from './ServerManager';
import { BrowserLauncher } from './BrowserLauncher';
import { ToolRunner } from './ToolRunner';
import * as fs from 'fs';
import * as path from 'path';
import Database from 'better-sqlite3';

export class MenuController {
  private serverManager: ServerManager;
  private browserLauncher: BrowserLauncher;
  private toolRunner: ToolRunner;
  private dbPath: string;

  constructor() {
    this.serverManager = new ServerManager(3001);
    this.browserLauncher = new BrowserLauncher();
    this.toolRunner = new ToolRunner();
    this.dbPath = path.join(process.cwd(), 'cdx_analysis.db');
  }

  /**
   * Start the interactive menu
   */
  async start(): Promise<void> {
    console.log('\n=================================');
    console.log('  Wayback Archive Toolkit Menu');
    console.log('=================================\n');

    // Setup graceful shutdown
    process.on('SIGINT', async () => {
      await this.shutdown();
    });

    // Main menu loop
    while (true) {
      const { action } = await inquirer.prompt([
        {
          type: 'list',
          name: 'action',
          message: 'What would you like to do?',
          choices: [
            {
              name: '🌐 Launch Browser Viewer',
              value: 'browser'
            },
            {
              name: '🔧 Run CLI Tools',
              value: 'tools'
            },
            {
              name: '📊 System Status',
              value: 'status'
            },
            new inquirer.Separator(),
            {
              name: '❌ Exit',
              value: 'exit'
            }
          ]
        }
      ]);

      switch (action) {
        case 'browser':
          await this.launchBrowser();
          break;
        case 'tools':
          await this.runTools();
          break;
        case 'status':
          await this.showStatus();
          break;
        case 'exit':
          await this.shutdown();
          return;
      }
    }
  }

  /**
   * Launch browser viewer
   */
  private async launchBrowser(): Promise<void> {
    console.log('\n--- Launch Browser Viewer ---\n');

    try {
      // Start server if not running
      await this.serverManager.start();

      // Open browser
      await this.browserLauncher.open(this.serverManager.getUrl());

      // Wait for user to return to menu
      await inquirer.prompt([
        {
          type: 'input',
          name: 'continue',
          message: 'Press Enter to return to menu (server will keep running)...'
        }
      ]);
    } catch (error: any) {
      console.error('Error launching browser:', error.message);
      await this.waitForKeypress();
    }
  }

  /**
   * Run CLI tools submenu
   */
  private async runTools(): Promise<void> {
    console.log('\n--- CLI Tools ---\n');
    await this.toolRunner.run();
  }

  /**
   * Show system status
   */
  private async showStatus(): Promise<void> {
    console.log('\n--- System Status ---\n');

    // Server status
    const serverRunning = this.serverManager.isRunning();
    console.log(`API Server: ${serverRunning ? '✓ Running' : '✗ Stopped'}`);
    if (serverRunning) {
      console.log(`  URL: ${this.serverManager.getUrl()}`);
    }

    // Database status
    const dbExists = fs.existsSync(this.dbPath);
    console.log(`Database: ${dbExists ? '✓ Found' : '✗ Not found'}`);
    if (dbExists) {
      console.log(`  Path: ${this.dbPath}`);

      try {
        const db = new Database(this.dbPath, { readonly: true });
        const domains = db.prepare('SELECT DISTINCT domain FROM snapshots ORDER BY domain').all();
        const totalSnapshots = db.prepare('SELECT COUNT(*) as count FROM snapshots').get() as any;
        db.close();

        console.log(`  Domains: ${domains.length}`);
        console.log(`  Total Snapshots: ${totalSnapshots.count}`);

        if (domains.length > 0) {
          console.log('\nAvailable Domains:');
          domains.slice(0, 10).forEach((row: any) => {
            console.log(`  - ${row.domain}`);
          });
          if (domains.length > 10) {
            console.log(`  ... and ${domains.length - 10} more`);
          }
        }
      } catch (error: any) {
        console.log(`  Error reading database: ${error.message}`);
      }
    }

    console.log('');
    await this.waitForKeypress();
  }

  /**
   * Wait for user to press Enter
   */
  private async waitForKeypress(): Promise<void> {
    await inquirer.prompt([
      {
        type: 'input',
        name: 'continue',
        message: 'Press Enter to continue...'
      }
    ]);
  }

  /**
   * Graceful shutdown
   */
  private async shutdown(): Promise<void> {
    console.log('\nShutting down...');
    await this.serverManager.stop();
    console.log('Goodbye!\n');
    process.exit(0);
  }
}
