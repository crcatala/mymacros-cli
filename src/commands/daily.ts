import type { Command } from 'commander'
import { createClient } from '../cli/client.js'
import type { CliContext } from '../cli/context.js'
import { logError, output } from '../cli/output.js'
import { renderTable } from '../cli/table.js'
import { resolveDate } from '../lib/date.js'
import type { NormalizedDailyMeals } from '../types.js'

function formatTable(ctx: CliContext, data: NormalizedDailyMeals): string {
  if (data.meals.length === 0) return `${data.date}\n\nNo meals logged.`

  const sections = data.meals.map((meal) => {
    const rows = meal.entries.map((entry) => [
      entry.uniqueId,
      entry.foodName,
      `${entry.servingSize} ${entry.servingName}`,
      String(entry.calories),
      String(entry.protein),
      String(entry.carbs),
      String(entry.fat),
    ])
    const totals = meal.totals
    return `${meal.name} (${totals.calories} kcal | ${totals.protein}P ${totals.carbs}C ${totals.fat}F)\n${renderTable(ctx, ['ID', 'Food', 'Serving', 'kcal', 'P', 'C', 'F'], rows)}`
  })

  const totals = data.dailyTotals
  return `${data.date}\n\n${sections.join('\n\n')}\n\nDaily Totals: ${totals.calories} kcal | ${totals.protein}P ${totals.carbs}C ${totals.fat}F`
}

function formatPlain(data: NormalizedDailyMeals): string {
  const lines: string[] = []
  lines.push(data.date)
  lines.push('')

  if (data.meals.length === 0) {
    lines.push('No meals logged.')
    return lines.join('\n')
  }

  for (const meal of data.meals) {
    const t = meal.totals
    lines.push(`${meal.name} (${t.calories} kcal | ${t.protein}P ${t.carbs}C ${t.fat}F)`)
    for (const e of meal.entries) {
      const id = `[${e.foodId}/${e.uniqueId}]`
      const name = e.foodName.padEnd(30)
      const serving = `${e.servingSize} ${e.servingName}`.padEnd(14)
      lines.push(
        `  ${id.padEnd(16)} ${name} ${serving} ${e.calories} kcal  ${e.protein}P ${e.carbs}C ${e.fat}F`,
      )
    }
    lines.push('')
  }

  const dt = data.dailyTotals
  lines.push(`Daily Totals: ${dt.calories} kcal | ${dt.protein}P ${dt.carbs}C ${dt.fat}F`)

  // Notes
  if (Object.keys(data.notes).length > 0) {
    lines.push('')
    for (const [key, value] of Object.entries(data.notes)) {
      lines.push(`Note (${key}): ${value}`)
    }
  }

  return lines.join('\n')
}

export function registerDailyCommand(program: Command, ctx: CliContext): void {
  program
    .command('daily')
    .description('Show meals for a date (default: today)')
    .argument('[date]', 'Date (YYYY-MM-DD, today, yesterday, tomorrow)', 'today')
    .action(async (dateInput: string) => {
      const resolved = resolveDate(dateInput)
      if (!resolved) {
        logError(
          ctx,
          `Invalid date: "${dateInput}". Use YYYY-MM-DD, today, yesterday, or tomorrow.`,
        )
        process.exitCode = 2
        return
      }

      const client = createClient(ctx)

      try {
        const data = await client.getDailyMeals(resolved.api)
        output(ctx, data, formatPlain, (result) => formatTable(ctx, result))
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        logError(ctx, message)
        process.exitCode = 1
      }
    })
}
