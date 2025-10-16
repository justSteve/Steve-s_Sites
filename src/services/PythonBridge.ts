/**
 * Service for executing Python scripts from TypeScript
 * Provides type-safe bridge between TypeScript and Python utilities
 */

import { spawn } from 'child_process';
import { LoggingService } from './LoggingService';

/**
 * Options for Python script execution
 */
export interface PythonExecutionOptions {
  /** Arguments to pass to the Python script */
  args?: string[];
  /** Working directory for script execution */
  cwd?: string;
  /** Timeout in milliseconds */
  timeout?: number;
  /** Environment variables */
  env?: NodeJS.ProcessEnv;
}

/**
 * Result from Python script execution
 */
export interface PythonExecutionResult<T = unknown> {
  /** Exit code from the Python process */
  exitCode: number;
  /** Parsed stdout data */
  data?: T;
  /** Raw stdout string */
  stdout: string;
  /** Raw stderr string */
  stderr: string;
  /** Error if execution failed */
  error?: Error;
}

/**
 * PythonBridge provides a type-safe way to execute Python scripts
 * from TypeScript, handling errors and data marshalling
 */
export class PythonBridge {
  private logger: LoggingService;

  /**
   * Creates a new PythonBridge instance
   * @param logger - LoggingService instance for error/debug logging
   */
  constructor(logger: LoggingService) {
    this.logger = logger;
  }

  /**
   * Execute a Python script and return the result
   * @param scriptPath - Path to the Python script
   * @param options - Execution options
   * @returns Promise with execution result
   */
  async execute<T = unknown>(
    scriptPath: string,
    options: PythonExecutionOptions = {}
  ): Promise<PythonExecutionResult<T>> {
    return new Promise((resolve) => {
      const { args = [], cwd, timeout = 300000, env } = options;

      this.logger.debug(`Executing Python script: ${scriptPath}`, { args });

      const pythonProcess = spawn('python3', [scriptPath, ...args], {
        cwd: cwd || process.cwd(),
        env: env || process.env,
      });

      let stdout = '';
      let stderr = '';
      let timeoutId: NodeJS.Timeout | null = null;

      // Set up timeout
      if (timeout > 0) {
        timeoutId = setTimeout(() => {
          pythonProcess.kill('SIGTERM');
          this.logger.error(`Python script timed out: ${scriptPath}`);
        }, timeout);
      }

      // Capture stdout
      pythonProcess.stdout.on('data', (data: Buffer) => {
        stdout += data.toString();
      });

      // Capture stderr
      pythonProcess.stderr.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      // Handle process completion
      pythonProcess.on('close', (exitCode: number) => {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }

        const result: PythonExecutionResult<T> = {
          exitCode,
          stdout,
          stderr,
        };

        // Log stderr if present
        if (stderr) {
          this.logger.warn(`Python script stderr: ${scriptPath}`, { stderr });
        }

        // Parse JSON output if successful
        if (exitCode === 0 && stdout) {
          try {
            result.data = JSON.parse(stdout) as T;
          } catch (error) {
            this.logger.debug('Python output is not JSON, returning raw stdout');
          }
        }

        // Log error if failed
        if (exitCode !== 0) {
          this.logger.error(`Python script failed: ${scriptPath}`, undefined, {
            exitCode,
            stderr,
          });
          result.error = new Error(`Python script exited with code ${exitCode}`);
        }

        resolve(result);
      });

      // Handle process errors
      pythonProcess.on('error', (error: Error) => {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }

        this.logger.error(`Failed to execute Python script: ${scriptPath}`, error);

        resolve({
          exitCode: -1,
          stdout,
          stderr,
          error,
        });
      });
    });
  }

  /**
   * Execute a Python script that outputs JSON
   * Throws an error if execution fails or output is not valid JSON
   * @param scriptPath - Path to the Python script
   * @param options - Execution options
   * @returns Promise with parsed JSON data
   */
  async executeJSON<T = unknown>(
    scriptPath: string,
    options: PythonExecutionOptions = {}
  ): Promise<T> {
    const result = await this.execute<T>(scriptPath, options);

    if (result.error || result.exitCode !== 0) {
      throw new Error(
        `Python script failed: ${result.error?.message || result.stderr}`
      );
    }

    if (!result.data) {
      throw new Error('Python script did not output valid JSON');
    }

    return result.data;
  }

  /**
   * Check if Python 3 is available in the system
   * @returns Promise resolving to true if Python 3 is available
   */
  async checkPythonAvailable(): Promise<boolean> {
    try {
      const result = await this.execute('--version', {
        args: [],
        timeout: 5000,
      });
      return result.exitCode === 0;
    } catch (error) {
      return false;
    }
  }
}
