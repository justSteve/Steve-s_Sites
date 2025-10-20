/**
 * Utility for loading and validating configuration files
 */

import { readFileSync } from 'fs';
import { DomainsConfigFile, DomainConfig } from '../domain/models/types';

/**
 * Load and parse the domains configuration file
 * @param configPath - Path to domains.json
 * @returns Parsed domains configuration
 * @throws Error if file cannot be read or parsed
 */
export function loadDomainsConfig(configPath: string): DomainsConfigFile {
  try {
    const content = readFileSync(configPath, 'utf-8');
    const config = JSON.parse(content) as DomainsConfigFile;

    // Validate structure
    if (!config.domains || !Array.isArray(config.domains)) {
      throw new Error('Invalid domains config: missing or invalid domains array');
    }

    // Validate each domain
    for (const domain of config.domains) {
      validateDomainConfig(domain);
    }

    return config;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error(`Configuration file not found: ${configPath}`);
    }
    throw error;
  }
}

/**
 * Validate a single domain configuration
 * @param domain - Domain configuration to validate
 * @throws Error if configuration is invalid
 */
function validateDomainConfig(domain: DomainConfig): void {
  if (!domain.name || typeof domain.name !== 'string') {
    throw new Error('Domain config must have a valid name');
  }

  if (!domain.priority || !['low', 'medium', 'high'].includes(domain.priority)) {
    throw new Error(`Invalid priority for domain ${domain.name}: must be low, medium, or high`);
  }

  if (!domain.activeYears || typeof domain.activeYears !== 'string') {
    throw new Error(`Invalid activeYears for domain ${domain.name}`);
  }
}

/**
 * Load environment variable with fallback
 * @param key - Environment variable key
 * @param defaultValue - Default value if not found
 * @returns Environment variable value or default
 */
export function getEnvVar(key: string, defaultValue: string): string {
  return process.env[key] || defaultValue;
}

/**
 * Load required environment variable
 * @param key - Environment variable key
 * @returns Environment variable value
 * @throws Error if variable is not set
 */
export function getRequiredEnvVar(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Required environment variable not set: ${key}`);
  }
  return value;
}
