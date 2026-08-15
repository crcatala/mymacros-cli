import type { Command } from 'commander'
import { createClient } from '../cli/client.js'
import type { CliContext } from '../cli/context.js'
import { logError, logSuccess, output } from '../cli/output.js'

function numberOption(
  value: string | undefined,
  name: string,
  required = true,
): number | undefined {
  if (value === undefined || value === '') {
    if (required) throw new Error(`Missing --${name}.`)
    return undefined
  }
  const parsed = Number.parseFloat(value)
  if (!Number.isFinite(parsed) || parsed < 0)
    throw new Error(`Invalid --${name}. Must be a non-negative number.`)
  return parsed
}

export function registerCreateFoodCommand(program: Command, ctx: CliContext): void {
  program
    .command('create-food')
    .description('Create a persistent custom food')
    .requiredOption('--name <name>', 'Food name')
    .option('--serving-size <n>', 'Serving size', '1')
    .option('--serving-name <name>', 'Serving unit name', 'Serving')
    .option('--brand <brand>', 'Brand', '')
    .requiredOption('--cal <n>', 'Calories')
    .requiredOption('--fat <n>', 'Total fat grams')
    .option('--sat-fat <n>', 'Saturated fat grams')
    .option('--mono-fat <n>', 'Monounsaturated fat grams')
    .option('--poly-fat <n>', 'Polyunsaturated fat grams')
    .option('--cholesterol <n>', 'Cholesterol milligrams', '0')
    .option('--sodium <n>', 'Sodium milligrams', '0')
    .requiredOption('--carbs <n>', 'Carbohydrate grams')
    .option('--fiber <n>', 'Fiber grams', '0')
    .option('--sugar <n>', 'Sugar grams', '0')
    .requiredOption('--protein <n>', 'Protein grams')
    .option('--type <type>', 'Food type/category', 'Other')
    .action(async (opts: Record<string, string>) => {
      try {
        const servingSize = numberOption(opts.servingSize, 'serving-size') as number
        const data = {
          name: opts.name.trim(),
          servingSize,
          servingName: opts.servingName,
          brand: opts.brand,
          calories: numberOption(opts.cal, 'cal') as number,
          fat: numberOption(opts.fat, 'fat') as number,
          saturatedFat: numberOption(opts.satFat, 'sat-fat', false),
          monoFat: numberOption(opts.monoFat, 'mono-fat', false),
          polyFat: numberOption(opts.polyFat, 'poly-fat', false),
          cholesterol: numberOption(opts.cholesterol, 'cholesterol') as number,
          sodium: numberOption(opts.sodium, 'sodium') as number,
          carbs: numberOption(opts.carbs, 'carbs') as number,
          fiber: numberOption(opts.fiber, 'fiber') as number,
          sugar: numberOption(opts.sugar, 'sugar') as number,
          protein: numberOption(opts.protein, 'protein') as number,
          foodType: opts.type,
        }
        if (!data.name) throw new Error('Food name cannot be empty.')

        const client = createClient(ctx)
        const result = await client.createCustomFood(data)
        output(ctx, { ...result, food: data }, () => `Created custom food "${data.name}"`)
        if (ctx.output.format !== 'json') logSuccess(ctx, `Created custom food "${data.name}"`)
      } catch (error) {
        logError(ctx, error instanceof Error ? error.message : String(error))
        process.exitCode = 1
      }
    })
}
