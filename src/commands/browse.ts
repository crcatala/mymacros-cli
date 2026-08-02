import type { Command } from 'commander'
import { createClient } from '../cli/client.js'
import type { CliContext } from '../cli/context.js'
import { logError, output } from '../cli/output.js'
import { renderTable } from '../cli/table.js'
import type { NormalizedFoodItem } from '../types.js'

// Menu ID mapping
// defaultCatName: required cat_name for direct-food categories (null = needs sub-category)
const CATEGORY_MAP: Record<
  string,
  { menuId: number; directFood: boolean; defaultCatName?: string }
> = {
  custom: { menuId: 1, directFood: true, defaultCatName: 'Custom & Favs' },
  recent: { menuId: 2, directFood: true, defaultCatName: 'Recent' },
  frequent: { menuId: 3, directFood: false },
  recipes: { menuId: 4, directFood: true, defaultCatName: 'Recipes' },
  types: { menuId: 5, directFood: false },
  brands: { menuId: 6, directFood: false },
}

function formatFoodLine(f: NormalizedFoodItem): string {
  const id = `[${f.foodId}]`.padEnd(12)
  const name = f.foodName.padEnd(35)
  const brand = f.brand ? `(${f.brand})`.padEnd(20) : ''.padEnd(20)
  const serving = `${f.servingSize} ${f.servingName}`.padEnd(14)
  const star = f.starred ? ' ⭐' : ''
  return `  ${id} ${name} ${brand} ${serving} ${f.calories} kcal  ${f.protein}P ${f.carbs}C ${f.fat}F${star}`
}

function formatFoodTable(ctx: CliContext, foods: NormalizedFoodItem[], total: number): string {
  const rows = foods.map((food) => [
    food.foodId,
    food.foodName,
    food.brand || '-',
    `${food.servingSize} ${food.servingName}`,
    String(food.calories),
    String(food.protein),
    String(food.carbs),
    String(food.fat),
  ])
  const more =
    total > foods.length ? `\n… ${total - foods.length} more (use --limit 0 for all)` : ''
  return `Results (${foods.length}${total > foods.length ? `/${total}` : ''}):\n${renderTable(ctx, ['ID', 'Food', 'Brand', 'Serving', 'kcal', 'P', 'C', 'F'], rows)}${more}`
}

function formatFoodList(foods: NormalizedFoodItem[], total: number, _limit: number): string {
  const lines: string[] = []
  const shown = foods.length
  lines.push(`Results (${shown}${total > shown ? `/${total}` : ''}):`)
  for (const f of foods) {
    lines.push(formatFoodLine(f))
  }
  if (total > shown) {
    lines.push(`  ... ${total - shown} more (use --limit 0 for all)`)
  }
  return lines.join('\n')
}

function formatCategories(categories: string[]): string {
  const lines = [`Categories (${categories.length}):`]
  for (const c of categories) {
    lines.push(`  ${c}`)
  }
  return lines.join('\n')
}

export function registerBrowseCommand(program: Command, ctx: CliContext): void {
  program
    .command('browse')
    .description('Browse foods by category')
    .argument('<category>', `Category: ${Object.keys(CATEGORY_MAP).join(', ')}`)
    .argument('[name]', 'Sub-category name (for types, brands, frequent)')
    .option('--limit <n>', 'Max results (0 = all)', '25')
    .action(async (category: string, name: string | undefined, opts: { limit: string }) => {
      const limit = Number.parseInt(opts.limit, 10)
      if (Number.isNaN(limit) || limit < 0) {
        logError(ctx, 'Invalid --limit value. Must be a non-negative integer.')
        process.exitCode = 2
        return
      }

      const catKey = category.toLowerCase()
      const catConfig = CATEGORY_MAP[catKey]
      if (!catConfig) {
        logError(
          ctx,
          `Unknown category: "${category}". Valid: ${Object.keys(CATEGORY_MAP).join(', ')}`,
        )
        process.exitCode = 2
        return
      }

      const client = createClient(ctx)

      try {
        // Direct-food categories (custom, recent, recipes) OR sub-category specified
        if (catConfig.directFood || name) {
          const catName = name ?? catConfig.defaultCatName
          const foods = await client.browseFoods(catConfig.menuId, catName, limit)
          output(
            ctx,
            { category: catKey, name: name ?? null, foods },
            (result) => formatFoodList(result.foods, result.foods.length, limit),
            (result) => formatFoodTable(ctx, result.foods, result.foods.length),
          )
        } else {
          // Two-step: show sub-categories first
          const categories = await client.browseCategories(catConfig.menuId)
          if (categories.length === 0) {
            logError(ctx, `No sub-categories found for "${category}". Try browsing directly.`)
            process.exitCode = 1
            return
          }
          output(
            ctx,
            { category: catKey, subcategories: categories },
            (result) => formatCategories(result.subcategories),
            (result) =>
              renderTable(
                ctx,
                ['Category'],
                result.subcategories.map((item) => [item]),
              ),
          )
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        logError(ctx, message)
        process.exitCode = 1
      }
    })
}
