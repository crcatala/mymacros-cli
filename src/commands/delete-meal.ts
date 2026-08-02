import type { Command } from 'commander'
import { createClient } from '../cli/client.js'
import type { CliContext } from '../cli/context.js'
import { logError, logSuccess, output, writeData } from '../cli/output.js'
import { resolveDate } from '../lib/date.js'

export function registerDeleteMealCommand(program: Command, ctx: CliContext): void {
  program
    .command('delete-meal')
    .description('Delete all foods from a meal')
    .argument('<meal_name>', 'Meal name (e.g., Breakfast, Lunch)')
    .option('--date <date>', 'Date (YYYY-MM-DD, today, yesterday, tomorrow)', 'today')
    .action(async (mealName: string, opts: { date: string }) => {
      const resolved = resolveDate(opts.date)
      if (!resolved) {
        logError(ctx, `Invalid --date: "${opts.date}".`)
        process.exitCode = 2
        return
      }

      const client = createClient(ctx)

      try {
        // Validate: check the meal has entries before deleting
        const daily = await client.getDailyMeals(resolved.api)
        const meal = daily.meals.find((m) => m.name.toLowerCase() === mealName.toLowerCase())

        if (!meal || meal.entries.length === 0) {
          logError(
            ctx,
            `No entries found in "${mealName}" on ${resolved.display}. Nothing to delete.`,
          )
          process.exitCode = 1
          return
        }

        const entryCount = meal.entries.length
        const actualMealName = meal.name // Use exact casing from API

        await client.deleteMeal(actualMealName, resolved.api)

        // Fetch updated daily
        const updated = await client.getDailyMeals(resolved.api)

        if (ctx.output.format === 'json') {
          output(ctx, {
            success: true,
            deleted: {
              mealName: actualMealName,
              date: resolved.display,
              entriesRemoved: entryCount,
            },
            daily: updated,
          })
        } else {
          logSuccess(
            ctx,
            `Deleted ${entryCount} entries from ${actualMealName} on ${resolved.display}`,
          )
          const dt = updated.dailyTotals
          writeData(`Daily: ${dt.calories} kcal | ${dt.protein}P ${dt.carbs}C ${dt.fat}F`)
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        logError(ctx, message)
        process.exitCode = 1
      }
    })
}
