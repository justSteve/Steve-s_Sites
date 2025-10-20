/**
 * Centralized logging service using Winston
 * Provides comprehensive logging with file and console transports
 */

import winston from 'winston';
import { LogLevel } from '../domain/models/types';

/**
 * LoggingService provides centralized, structured logging
 * for all application and error messages
 */
export class LoggingService {
  private logger: winston.Logger;
  private context: string;

  /**
   * Creates a new LoggingService instance
   * @param context - The context/module name for log messages
   * @param logFile - Path to the log file
   * @param level - Minimum logging level (default: 'info')
   */
  constructor(context: string, logFile: string, level: LogLevel = 'info') {
    this.context = context;

    // Configure winston logger with both file and console transports
    this.logger = winston.createLogger({
      level,
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.errors({ stack: true }),
        winston.format.splat(),
        winston.format.json()
      ),
      defaultMeta: { context: this.context },
      transports: [
        // File transport for all logs
        new winston.transports.File({
          filename: logFile,
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.json()
          ),
        }),
        // Console transport with human-readable format
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.printf(({ level, message, context, timestamp }) => {
              return `${timestamp} [${context}] ${level}: ${message}`;
            })
          ),
        }),
      ],
    });
  }

  /**
   * Log an informational message
   * @param message - The message to log
   * @param meta - Additional metadata
   */
  info(message: string, meta?: Record<string, unknown>): void {
    this.logger.info(message, meta);
  }

  /**
   * Log a warning message
   * @param message - The message to log
   * @param meta - Additional metadata
   */
  warn(message: string, meta?: Record<string, unknown>): void {
    this.logger.warn(message, meta);
  }

  /**
   * Log an error message
   * @param message - The error message
   * @param error - The error object (optional)
   * @param meta - Additional metadata
   */
  error(message: string, error?: Error, meta?: Record<string, unknown>): void {
    this.logger.error(message, {
      ...meta,
      error: error
        ? {
            message: error.message,
            stack: error.stack,
            name: error.name,
          }
        : undefined,
    });
  }

  /**
   * Log a debug message
   * @param message - The message to log
   * @param meta - Additional metadata
   */
  debug(message: string, meta?: Record<string, unknown>): void {
    this.logger.debug(message, meta);
  }

  /**
   * Create a child logger with additional context
   * @param childContext - Additional context to append
   * @returns A new LoggingService instance
   */
  child(childContext: string): LoggingService {
    const newContext = `${this.context}:${childContext}`;
    const logFile = this.logger.transports.find(
      (t) => t instanceof winston.transports.File
    ) as winston.transports.FileTransportInstance;

    return new LoggingService(
      newContext,
      logFile?.filename || 'app.log',
      this.logger.level as LogLevel
    );
  }

  /**
   * Close the logger and flush any pending writes
   */
  async close(): Promise<void> {
    return new Promise((resolve) => {
      this.logger.on('finish', resolve);
      this.logger.end();
    });
  }
}

/**
 * Factory function to create a logger instance
 * @param context - The context/module name
 * @param logFile - Path to the log file
 * @param level - Logging level
 * @returns A configured LoggingService instance
 */
export function createLogger(
  context: string,
  logFile: string,
  level: LogLevel = 'info'
): LoggingService {
  return new LoggingService(context, logFile, level);
}
