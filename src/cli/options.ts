import type { Command } from 'commander'

/** Register output and diagnostic options shared by every mymacros invocation. */
export function addOutputOptions(command: Command): Command {
  return command
    .option('--json', 'Force JSON output')
    .option('--plain', 'Force human-readable output')
    .option('--table', 'Force table output')
    .option('-q, --quiet', 'Minimal output')
    .option('--debug', 'Show HTTP request/response details')
    .option('--no-color', 'Disable colors')
}
