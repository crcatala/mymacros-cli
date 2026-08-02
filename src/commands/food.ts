import type { Command } from 'commander'
import { createClient } from '../cli/client.js'
import type { CliContext } from '../cli/context.js'
import { logError, output } from '../cli/output.js'
import type { NormalizedFoodItem } from '../types.js'

function formatPlain(data: {
  food: NormalizedFoodItem
  meals: { id: string; name: string }[]
}): string {
  const f = data.food
  const lines: string[] = []
  lines.push(`${f.foodName}${f.brand ? ` (${f.brand})` : ''}`)
  lines.push(`  Food ID:       ${f.foodId}${f.isCustom ? ' (custom)' : ''}`)
  lines.push(`  Serving:       ${f.servingSize} ${f.servingName}`)
  lines.push(`  Starred:       ${f.starred ? 'yes' : 'no'}`)
  lines.push('')
  lines.push('  Nutrition (per serving):')
  lines.push(`    Calories:      ${f.calories}`)
  lines.push(`    Protein:       ${f.protein}g`)
  lines.push(`    Carbs:         ${f.carbs}g`)
  lines.push(`    Fat:           ${f.fat}g`)
  lines.push(`    Saturated Fat: ${f.saturatedFat}g`)
  lines.push(`    Fiber:         ${f.fiber}g`)
  lines.push(`    Sugar:         ${f.sugar}g`)
  lines.push(`    Sodium:        ${f.sodium}mg`)
  lines.push(`    Cholesterol:   ${f.cholesterol}mg`)

  if (data.meals.length > 0) {
    lines.push('')
    lines.push(`  Meals: ${data.meals.map((m) => `${m.name} (id:${m.id})`).join(', ')}`)
  }

  return lines.join('\n')
}

export function registerFoodCommand(program: Command, ctx: CliContext): void {
  program
    .command('food')
    .description('Show details for a food item')
    .argument('<food_id>', 'Food ID (use -- before negative IDs, e.g. -- -2288)')
    .action(async (foodId: string) => {
      if (!foodId.trim()) {
        logError(ctx, 'Food ID is required.')
        process.exitCode = 2
        return
      }

      const client = createClient(ctx)

      try {
        const data = await client.getFoodItem(foodId.trim())
        output(ctx, data, formatPlain)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        logError(ctx, message)
        process.exitCode = 1
      }
    })
}
