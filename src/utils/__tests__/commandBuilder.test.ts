import { buildCommand, CommandOptions } from '../commandBuilder';

describe('buildCommand', () => {
  test('builds cdx-analyzer command', () => {
    const options: CommandOptions = {
      tool: 'cdx-analyzer',
      config: 'domains.json',
    };

    const result = buildCommand(options);

    expect(result).toBe('npm run cdx-analyzer -- --config domains.json');
  });

  test('builds crawler command with negated flags', () => {
    const options: CommandOptions = {
      tool: 'crawler',
      snapshots: 'selected_snapshots.txt',
      fetchAssets: true,
      useScheduler: false,
    };

    const result = buildCommand(options);

    expect(result).toBe('npm run crawler -- --snapshots selected_snapshots.txt --no-scheduler');
  });

  test('builds selector command with positional domain', () => {
    const options: CommandOptions = {
      tool: 'selector',
      domain: 'example.com',
      export: 'output.txt',
    };

    const result = buildCommand(options);

    expect(result).toBe('npm run selector -- example.com --export output.txt');
  });

  test('builds generator command with optional domain', () => {
    const options: CommandOptions = {
      tool: 'generator',
      output: 'reports',
    };

    const result = buildCommand(options);

    expect(result).toBe('npm run generator -- --output reports');
  });
});
