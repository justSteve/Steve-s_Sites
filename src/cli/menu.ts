#!/usr/bin/env node
/**
 * Interactive Menu for Wayback Archive Toolkit
 *
 * This is the main entry point for the interactive CLI.
 * It provides a menu to:
 * - Launch the browser viewer (starts API server + opens browser)
 * - Run existing CLI tools with interactive prompts
 * - View system status
 */

import { MenuController } from './MenuController';

async function main() {
  const controller = new MenuController();
  await controller.start();
}

// Handle unhandled rejections
process.on('unhandledRejection', (error: any) => {
  console.error('Unhandled error:', error.message);
  process.exit(1);
});

main().catch((error) => {
  console.error('Fatal error:', error.message);
  process.exit(1);
});
