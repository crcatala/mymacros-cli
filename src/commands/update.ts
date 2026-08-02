import type { Command } from 'commander'
import { createClient } from '../cli/client.js'
import type { CliContext } from '../cli/context.js'
import { logError, logSuccess, logWarning, output, writeData } from '../cli/output.js'
import { resolveDate } from '../lib/date.js'

export function registerUpdateCommand(program: Command, ctx: CliContext): void {
  program
    .command('update')
    .description('Update a food entry (serving size or move between meals)')
    .argument('<unique_id>', 'Unique entry ID (from daily command output)')
    .option('--serving <n>', 'New serving size')
    .option('--meal <name>', 'Move to this meal')
    .option('--date <date>', 'Date (YYYY-MM-DD, today, yesterday, tomorrow)', 'today')
    .action(async (uniqueId: string, opts: { serving?: string; meal?: string; date: string }) => {
      if (!uniqueId.trim()) {
        logError(ctx, 'unique_id is required.')
        process.exitCode = 2
        return
      }

      // Must provide at least one change
      if (!opts.serving && !opts.meal) {
        logError(ctx, 'Provide at least one of --serving or --meal to update.')
        process.exitCode = 2
        return
      }

      // Validate serving if provided
      let newServingSize: number | undefined
      if (opts.serving) {
        newServingSize = Number.parseFloat(opts.serving)
        if (Number.isNaN(newServingSize) || newServingSize <= 0) {
          logError(ctx, 'Invalid --serving value. Must be a positive number.')
          process.exitCode = 2
          return
        }
      }

      const resolved = resolveDate(opts.date)
      if (!resolved) {
        logError(ctx, `Invalid --date: "${opts.date}".`)
        process.exitCode = 2
        return
      }

      const client = createClient(ctx)

      try {
        // Step 1: Fetch daily to find the entry
        const daily = await client.getDailyMeals(resolved.api)
        let foundEntry: {
          foodId: string
          uniqueId: string
          mealName: string
          servingName: string
          servingSize: number
          foodName: string
        } | null = null

        for (const meal of daily.meals) {
          for (const entry of meal.entries) {
            if (entry.uniqueId === uniqueId.trim()) {
              foundEntry = {
                foodId: entry.foodId,
                uniqueId: entry.uniqueId,
                mealName: entry.mealName,
                servingName: entry.servingName,
                servingSize: entry.servingSize,
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
            `Entry with uniqueId "${uniqueId}" not found on ${resolved.display}.${allIds.length > 0 ? ` Available: ${allIds.join(', ')}` : ''}`,
          )
          process.exitCode = 1
          return
        }

        // Step 2: Validate target meal if moving
        const newMealName = opts.meal ?? foundEntry.mealName

        // Step 3: Update
        await client.updateFood({
          foodId: foundEntry.foodId,
          preUniqueId: foundEntry.uniqueId,
          preMealName: foundEntry.mealName,
          preServingName: foundEntry.servingName,
          newMealName,
          newServingSize: newServingSize ?? foundEntry.servingSize,
          date: resolved.api,
        })

        // Step 4: Fetch updated daily to get the NEW uniqueId
        const updated = await client.getDailyMeals(resolved.api)

        // Updates delete and re-insert the entry. Select only IDs that were not
        // present before the update so an existing duplicate is never reported.
        const previousIds = new Set(
          daily.meals.flatMap((meal) => meal.entries.map((entry) => entry.uniqueId)),
        )
        const replacementEntries = updated.meals
          .flatMap((meal) => meal.entries)
          .filter(
            (entry) =>
              entry.foodId === foundEntry.foodId &&
              entry.mealName === newMealName &&
              !previousIds.has(entry.uniqueId),
          )
        const newUniqueId = replacementEntries.length === 1 ? replacementEntries[0].uniqueId : null

        if (ctx.output.format === 'json') {
          output(ctx, {
            success: true,
            updated: {
              foodName: foundEntry.foodName,
              oldUniqueId: foundEntry.uniqueId,
              newUniqueId: newUniqueId ?? 'unknown',
              mealName: newMealName,
              servingSize: newServingSize ?? foundEntry.servingSize,
            },
            daily: updated,
          })
        } else {
          const changes: string[] = []
          if (newServingSize) changes.push(`serving: ${foundEntry.servingSize} → ${newServingSize}`)
          if (opts.meal) changes.push(`meal: ${foundEntry.mealName} → ${newMealName}`)
          logSuccess(ctx, `Updated ${foundEntry.foodName} (${changes.join(', ')})`)
          if (newUniqueId) {
            logWarning(ctx, `New uniqueId: ${newUniqueId} (changed from ${foundEntry.uniqueId})`)
          }
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
