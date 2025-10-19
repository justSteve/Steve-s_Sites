import open from 'open';

export class BrowserLauncher {
  /**
   * Open URL in default browser
   */
  async open(url: string): Promise<void> {
    try {
      console.log(`Opening browser to ${url}...`);
      await open(url);
      console.log('Browser opened successfully');
    } catch (error: any) {
      console.warn(`Failed to open browser: ${error.message}`);
      console.log(`Please manually navigate to: ${url}`);
    }
  }
}
