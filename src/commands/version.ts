import type { Command } from 'commander'
import type { CliContext } from '../cli/context.js'
import { writeData } from '../cli/output.js'
import { versionDetails } from '../cli-meta.js'

export function registerVersionCommand(program: Command, ctx: CliContext): void {
  program
    .command('version')
    .description('Print version, commit, date, install method and install path')
    .action(() => {
      const details = versionDetails()
      // `--json` is a global flag (see addOutputOptions); honor it like every other command.
      writeData(
        ctx.output.format === 'json'
          ? JSON.stringify(details)
          : Object.entries(details)
              .map(([key, value]) => `${key}: ${value}`)
              .join('\n'),
      )
    })
}
