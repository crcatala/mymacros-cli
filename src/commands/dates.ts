import type { Command } from 'commander'
import { createClient } from '../cli/client.js'
import type { CliContext } from '../cli/context.js'
import { logError, output } from '../cli/output.js'
import { renderTable } from '../cli/table.js'

function formatPlain(dates: string[], limit: number): string {
  const shown = limit > 0 ? dates.slice(0, limit) : dates
  const lines = shown.map((d) => `  ${d}`)
  if (limit > 0 && dates.length > limit) {
    lines.push(`  ... ${dates.length - limit} more (use --limit 0 for all)`)
  }
  lines.unshift(`Dates with logged data (${dates.length} total):`)
  return lines.join('\n')
}

export function registerDatesCommand(program: Command, ctx: CliContext): void {
  program
    .command('dates')
    .description('List all dates with logged data')
    .option('--limit <n>', 'Max dates to show (0 = all)', '25')
    .action(async (opts: { limit: string }) => {
      const limit = Number.parseInt(opts.limit, 10)
      if (Number.isNaN(limit) || limit < 0) {
        logError(ctx, 'Invalid --limit value. Must be a non-negative integer.')
        process.exitCode = 2
        return
      }

      const client = createClient(ctx)

      try {
        const dates = await client.getDates()
        const result = limit > 0 ? dates.slice(0, limit) : dates
        output(
          ctx,
          { total: dates.length, dates: result },
          () => formatPlain(dates, limit),
          (value) =>
            renderTable(
              ctx,
              ['Date'],
              value.dates.map((date) => [date]),
            ),
        )
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        logError(ctx, message)
        process.exitCode = 1
      }
    })
}
