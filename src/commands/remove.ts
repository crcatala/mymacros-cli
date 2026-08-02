import type { Command } from 'commander'
import { createClient } from '../cli/client.js'
import type { CliContext } from '../cli/context.js'
import { logError, logSuccess, output, writeData } from '../cli/output.js'
import { resolveDate } from '../lib/date.js'

export function registerRemoveCommand(program: Command, ctx: CliContext): void {
  program
    .command('remove')
    .description('Remove a food entry from a meal (by uniqueId from daily output)')
    .argument('<unique_id>', 'Unique entry ID (from daily command output)')
    .option('--date <date>', 'Date (YYYY-MM-DD, today, yesterday, tomorrow)', 'today')
    .action(async (uniqueId: string, opts: { date: string }) => {
      if (!uniqueId.trim()) {
        logError(ctx, 'unique_id is required.')
        process.exitCode = 2
        return
      }

      const resolved = resolveDate(opts.date)
      if (!resolved) {
        logError(ctx, `Invalid --date: "${opts.date}".`)
        process.exitCode = 2
        return
      }

      const client = createClient(ctx)

      try {
        // Step 1: Fetch daily to find the entry by uniqueId
        const daily = await client.getDailyMeals(resolved.api)
        let foundEntry: { foodId: string; mealName: string; foodName: string } | null = null

        for (const meal of daily.meals) {
          for (const entry of meal.entries) {
            if (entry.uniqueId === uniqueId.trim()) {
              foundEntry = {
                foodId: entry.foodId,
                mealName: entry.mealName,
                foodName: entry.foodName,
              }
              break
            }
          }
          if (foundEntry) break
        }

        if (!foundEntry) {
          const allIds = daily.meals.flatMap((m) =>
            m.entries.map((e) => `${e.uniqueId} (${e.foodName})`),
          )
          logError(
            ctx,
            `Entry with uniqueId "${uniqueId}" not found on ${resolved.display}.${allIds.length > 0 ? ` Available: ${allIds.join(', ')}` : ' No entries for this date.'}`,
          )
          process.exitCode = 1
          return
        }

        // Step 2: Remove the entry
        await client.removeFood({
          uniqueId: uniqueId.trim(),
          foodId: foundEntry.foodId,
          mealName: foundEntry.mealName,
          date: resolved.api,
        })

        // Step 3: Fetch updated daily
        const updated = await client.getDailyMeals(resolved.api)

        if (ctx.output.format === 'json') {
          output(ctx, {
            success: true,
            removed: {
              uniqueId: uniqueId.trim(),
              foodId: foundEntry.foodId,
              foodName: foundEntry.foodName,
              mealName: foundEntry.mealName,
            },
            daily: updated,
          })
        } else {
          logSuccess(ctx, `Removed ${foundEntry.foodName} from ${foundEntry.mealName}`)
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
