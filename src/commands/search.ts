import type { Command } from 'commander'
import { createClient } from '../cli/client.js'
import type { CliContext } from '../cli/context.js'
import { logError, output } from '../cli/output.js'
import { renderTable } from '../cli/table.js'
import type { NormalizedFoodItem, NormalizedSearchResults } from '../types.js'

function formatFoodLine(f: NormalizedFoodItem): string {
  const id = `[${f.foodId}]`.padEnd(12)
  const name = f.foodName.padEnd(35)
  const brand = f.brand ? `(${f.brand})`.padEnd(20) : ''.padEnd(20)
  const serving = `${f.servingSize} ${f.servingName}`.padEnd(14)
  const star = f.starred ? ' ⭐' : ''
  return `  ${id} ${name} ${brand} ${serving} ${f.calories} kcal  ${f.protein}P ${f.carbs}C ${f.fat}F${star}`
}

function formatTable(ctx: CliContext, data: NormalizedSearchResults): string {
  return data.sections
    .map((section) => {
      const rows = section.foods.map((food) => [
        food.foodId,
        food.foodName,
        food.brand || '-',
        `${food.servingSize} ${food.servingName}`,
        String(food.calories),
        String(food.protein),
        String(food.carbs),
        String(food.fat),
      ])
      const shown = section.foods.length
      const heading =
        shown < section.count
          ? `${section.title} (${shown}/${section.count})`
          : `${section.title} (${section.count})`
      const more =
        shown < section.count ? `\n… ${section.count - shown} more (use --limit 0 for all)` : ''
      return `${heading}\n${renderTable(ctx, ['ID', 'Food', 'Brand', 'Serving', 'kcal', 'P', 'C', 'F'], rows)}${more}`
    })
    .join('\n\n')
}

function formatPlain(data: NormalizedSearchResults): string {
  const lines: string[] = []
  for (const section of data.sections) {
    const shown = section.foods.length
    const label =
      shown < section.count
        ? `${section.title} (${shown}/${section.count})`
        : `${section.title} (${section.count})`
    lines.push(label)
    for (const f of section.foods) {
      lines.push(formatFoodLine(f))
    }
    if (shown < section.count) {
      lines.push(`  ... ${section.count - shown} more (use --limit 0 for all)`)
    }
    lines.push('')
  }
  return lines.join('\n').trimEnd()
}

export function registerSearchCommand(program: Command, ctx: CliContext): void {
  program
    .command('search')
    .description('Search the food database')
    .argument('<keyword>', 'Search keyword')
    .option('--limit <n>', 'Max results per section (0 = all)', '25')
    .action(async (keyword: string, opts: { limit: string }) => {
      const limit = Number.parseInt(opts.limit, 10)
      if (Number.isNaN(limit) || limit < 0) {
        logError(ctx, 'Invalid --limit value. Must be a non-negative integer.')
        process.exitCode = 2
        return
      }

      if (!keyword.trim()) {
        logError(ctx, 'Search keyword cannot be empty.')
        process.exitCode = 2
        return
      }

      const client = createClient(ctx)

      try {
        const data = await client.searchFood(keyword.trim(), limit)
        output(ctx, data, formatPlain, (result) => formatTable(ctx, result))
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        logError(ctx, message)
        process.exitCode = 1
      }
    })
}
