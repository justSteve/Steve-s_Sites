export interface CommandOptions {
  tool: 'cdx-analyzer' | 'crawler' | 'selector' | 'generator';
  [key: string]: any;
}

/**
 * Build command string from options
 * Reuses ToolRunner logic for CLI flag generation
 */
export function buildCommand(options: CommandOptions): string {
  const { tool, ...params } = options;
  const args = buildArgs(params, tool);

  return `npm run ${tool} -- ${args.join(' ')}`;
}

/**
 * Build command arguments from options
 * Maps to actual CLI flag names, handles negated booleans and positional args
 */
export function buildArgs(options: any, toolScript: string): string[] {
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
    const negatedFlag = getNegatedFlag(key);

    if (value === true) {
      // For negated options (fetchAssets, useScheduler), true means use default (no flag)
      // For regular options, true means add the flag
      if (!negatedFlag) {
        const flagName = mapToCliFlag(key);
        args.push(`--${flagName}`);
      }
    } else if (value === false) {
      // For negated booleans, use the actual negated flag from CLI
      if (negatedFlag) {
        args.push(negatedFlag);
      }
    } else if (value) {
      // For non-boolean values, add flag with value
      const flagName = mapToCliFlag(key);
      args.push(`--${flagName}`, String(value));
    }
  }

  return args;
}

/**
 * Map camelCase prompt names to CLI flag names
 */
function mapToCliFlag(key: string): string {
  // Convert camelCase to kebab-case for CLI flags
  return key.replace(/([A-Z])/g, '-$1').toLowerCase();
}

/**
 * Get the actual negated flag name for boolean options
 * Maps to actual CLI definitions (e.g., --no-fetch-assets, not --no-fetchAssets)
 */
function getNegatedFlag(key: string): string | null {
  const negatedFlags: Record<string, string> = {
    'fetchAssets': '--no-fetch-assets',
    'useScheduler': '--no-scheduler',
    'fetchExternalAssets': '--no-external-assets',
  };
  return negatedFlags[key] || null;
}
