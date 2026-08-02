import type { Command } from 'commander'
import { createClient } from '../cli/client.js'
import type { CliContext } from '../cli/context.js'
import { logError, logSuccess, output } from '../cli/output.js'
import { resolveDate } from '../lib/date.js'

export function registerNoteCommand(program: Command, ctx: CliContext): void {
  program
    .command('note')
    .description('Save a day or meal note')
    .argument('<text>', 'Note text (use "" to clear)')
    .option('--meal <name>', 'Meal name for meal-specific note (omit for day note)')
    .option('--date <date>', 'Date', 'today')
    .action(async (text: string, opts: { meal?: string; date: string }) => {
      const resolved = resolveDate(opts.date)
      if (!resolved) {
        logError(ctx, `Invalid --date: "${opts.date}".`)
        process.exitCode = 2
        return
      }

      const client = createClient(ctx)

      try {
        // API uses "--1" for day-level notes, meal name string for meal notes
        const mealNameParam = opts.meal ?? '--1'
        const label = opts.meal ?? 'day'

        await client.saveNote({
          mealName: mealNameParam,
          note: text,
          date: resolved.api,
        })

        if (ctx.output.format === 'json') {
          output(ctx, {
            success: true,
            note: {
              type: opts.meal ? 'meal' : 'day',
              mealName: opts.meal ?? null,
              text,
              date: resolved.display,
            },
          })
        } else {
          if (text === '') {
            logSuccess(ctx, `Cleared ${label} note on ${resolved.display}`)
          } else {
            logSuccess(ctx, `Saved ${label} note on ${resolved.display}: "${text}"`)
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        logError(ctx, message)
        process.exitCode = 1
      }
    })
}
