import type { Command } from 'commander'
import { createClient } from '../cli/client.js'
import type { CliContext } from '../cli/context.js'
import { logError, logSuccess, output, writeData } from '../cli/output.js'
import { resolveDate } from '../lib/date.js'

export function registerCopyMealCommand(program: Command, ctx: CliContext): void {
  program
    .command('copy-meal')
    .description('Copy all foods from a meal to another date/meal')
    .argument('<meal_name>', 'Source meal name (e.g., Breakfast)')
    .requiredOption('--to-date <date>', 'Target date (YYYY-MM-DD, today, yesterday, tomorrow)')
    .option('--to-meal <name>', 'Target meal name (defaults to same as source)')
    .option('--date <date>', 'Source date', 'today')
    .action(async (mealName: string, opts: { toDate: string; toMeal?: string; date: string }) => {
      // Validate source date
      const fromResolved = resolveDate(opts.date)
      if (!fromResolved) {
        logError(ctx, `Invalid --date: "${opts.date}".`)
        process.exitCode = 2
        return
      }

      // Validate target date
      const toResolved = resolveDate(opts.toDate)
      if (!toResolved) {
        logError(ctx, `Invalid --to-date: "${opts.toDate}".`)
        process.exitCode = 2
        return
      }

      const client = createClient(ctx)

      try {
        // Fetch source daily to get uniqueIds and validate meal
        const daily = await client.getDailyMeals(fromResolved.api)
        const sourceMeal = daily.meals.find((m) => m.name.toLowerCase() === mealName.toLowerCase())

        if (!sourceMeal || sourceMeal.entries.length === 0) {
          const available = daily.meals.filter((m) => m.entries.length > 0).map((m) => m.name)
          logError(
            ctx,
            `No entries found in "${mealName}" on ${fromResolved.display}.${available.length > 0 ? ` Meals with food: ${available.join(', ')}` : ''}`,
          )
          process.exitCode = 1
          return
        }

        // Resolve target meal info
        const toMealName = opts.toMeal ?? sourceMeal.name
        // We need meal IDs — fetch from food item endpoint
        const { meals } = await client.getFoodItem(sourceMeal.entries[0].foodId)
        const targetMeal = meals.find((m) => m.name.toLowerCase() === toMealName.toLowerCase())
        if (!targetMeal) {
          const validNames = meals.map((m) => m.name).join(', ')
          logError(ctx, `Unknown target meal: "${toMealName}". Valid: ${validNames}`)
          process.exitCode = 2
          return
        }

        const uniqueIds = sourceMeal.entries.map((e) => e.uniqueId)

        await client.copyMeal({
          fromDate: fromResolved.api,
          toDate: toResolved.api,
          fromMealName: sourceMeal.name,
          newMealId: targetMeal.id,
          newMealOrder: targetMeal.id,
          newMealName: targetMeal.name,
          copiedUniqueIds: uniqueIds,
        })

        // Fetch target daily to show result
        const updated = await client.getDailyMeals(toResolved.api)

        if (ctx.output.format === 'json') {
          output(ctx, {
            success: true,
            copied: {
              fromDate: fromResolved.display,
              toDate: toResolved.display,
              fromMeal: sourceMeal.name,
              toMeal: targetMeal.name,
              entriesCopied: uniqueIds.length,
            },
            daily: updated,
          })
        } else {
          logSuccess(
            ctx,
            `Copied ${uniqueIds.length} items from ${sourceMeal.name} (${fromResolved.display}) → ${targetMeal.name} (${toResolved.display})`,
          )
          const dt = updated.dailyTotals
          writeData(
            `${toResolved.display} Daily: ${dt.calories} kcal | ${dt.protein}P ${dt.carbs}C ${dt.fat}F`,
          )
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        logError(ctx, message)
        process.exitCode = 1
      }
    })
}
