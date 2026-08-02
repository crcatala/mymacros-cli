import type { Command } from 'commander'
import { createClient } from '../cli/client.js'
import type { CliContext } from '../cli/context.js'
import { logError, logSuccess, output, writeData } from '../cli/output.js'
import { resolveDate } from '../lib/date.js'

export function registerAddCommand(program: Command, ctx: CliContext): void {
  program
    .command('add')
    .description('Add a food to a meal')
    .argument('<food_id>', 'Food ID (from search results)')
    .option('--meal <name>', 'Meal name (e.g., Breakfast, Lunch)')
    .option('--serving <n>', 'Serving size quantity', '1')
    .option('--date <date>', 'Date (YYYY-MM-DD, today, yesterday, tomorrow)', 'today')
    .action(async (foodId: string, opts: { meal?: string; serving: string; date: string }) => {
      // Validate serving
      const servingSize = Number.parseFloat(opts.serving)
      if (Number.isNaN(servingSize) || servingSize <= 0) {
        logError(ctx, 'Invalid --serving value. Must be a positive number.')
        process.exitCode = 2
        return
      }

      // Validate date
      const resolved = resolveDate(opts.date)
      if (!resolved) {
        logError(
          ctx,
          `Invalid --date: "${opts.date}". Use YYYY-MM-DD, today, yesterday, or tomorrow.`,
        )
        process.exitCode = 2
        return
      }

      const client = createClient(ctx)

      try {
        // Step 1: Fetch food details (required for serving_name, food_user_id)
        const { food, meals } = await client.getFoodItem(foodId.trim())

        // Step 2: Resolve meal
        let mealName = opts.meal
        let mealId = '0'
        let mealOrder = '0'

        if (mealName) {
          // Validate meal name against available meals
          const match = meals.find((m) => m.name.toLowerCase() === mealName?.toLowerCase())
          if (!match) {
            const validNames = meals.map((m) => m.name).join(', ')
            logError(ctx, `Unknown meal: "${mealName}". Valid meals: ${validNames}`)
            process.exitCode = 2
            return
          }
          mealName = match.name
          mealId = match.id
          mealOrder = match.id
        } else {
          // Default to first meal
          if (meals.length > 0) {
            mealName = meals[0].name
            mealId = meals[0].id
            mealOrder = meals[0].id
          } else {
            mealName = 'Breakfast'
          }
        }

        // Step 3: Determine food_user_id
        // Custom foods (negative ID) use the user's ID from the food item
        // DB foods use "-1"
        const _foodUserId = food.isCustom ? food.foodId.replace('-', '') : '-1'
        // Actually, for custom foods the API needs the user's actual ID, not the food ID
        // The userID field from the raw API response has this, but we normalized it away
        // Let's re-fetch to get the raw userID
        const rawResult = await client.getRawFoodItem(foodId.trim())
        const actualFoodUserId = rawResult.food_item?.userID ?? '-1'

        // Step 4: Add the food
        await client.addFood({
          foodId: food.foodId,
          mealName,
          mealId,
          mealOrder,
          servingSize,
          servingName: food.servingName,
          foodUserId: actualFoodUserId,
          date: resolved.api,
        })

        // Step 5: Fetch updated daily to show result
        const daily = await client.getDailyMeals(resolved.api)

        if (ctx.output.format === 'json') {
          output(ctx, {
            success: true,
            added: {
              foodId: food.foodId,
              foodName: food.foodName,
              mealName,
              servingSize,
              servingName: food.servingName,
            },
            daily,
          })
        } else {
          logSuccess(
            ctx,
            `Added ${food.foodName} (${servingSize} ${food.servingName}) to ${mealName}`,
          )
          // Show updated meal totals
          const meal = daily.meals.find((m) => m.name === mealName)
          if (meal) {
            const t = meal.totals
            writeData(`${mealName}: ${t.calories} kcal | ${t.protein}P ${t.carbs}C ${t.fat}F`)
          }
          const dt = daily.dailyTotals
          writeData(`Daily: ${dt.calories} kcal | ${dt.protein}P ${dt.carbs}C ${dt.fat}F`)
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        logError(ctx, message)
        process.exitCode = 1
      }
    })

  // Quick add (fast track)
  program
    .command('add-quick')
    .description('Quick-add food by macros (creates a persistent custom food)')
    .option('--name <name>', 'Food name (required)')
    .option('--cal <n>', 'Calories (required)')
    .option('--protein <n>', 'Protein grams (required)')
    .option('--carbs <n>', 'Carb grams (required)')
    .option('--fat <n>', 'Fat grams (required)')
    .option('--meal <name>', 'Meal name', 'Breakfast')
    .option('--date <date>', 'Date', 'today')
    .action(
      async (opts: {
        name?: string
        cal?: string
        protein?: string
        carbs?: string
        fat?: string
        meal: string
        date: string
      }) => {
        // Validate required fields
        if (!opts.name?.trim()) {
          logError(
            ctx,
            'Missing --name. All of --name, --cal, --protein, --carbs, --fat are required.',
          )
          process.exitCode = 2
          return
        }

        const cal = Number.parseFloat(opts.cal ?? '')
        const protein = Number.parseFloat(opts.protein ?? '')
        const carbs = Number.parseFloat(opts.carbs ?? '')
        const fat = Number.parseFloat(opts.fat ?? '')

        if ([cal, protein, carbs, fat].some((v) => Number.isNaN(v) || v < 0)) {
          logError(
            ctx,
            'Invalid macro values. --cal, --protein, --carbs, --fat must be non-negative numbers.',
          )
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
          const meals = await client.getActiveMeals(resolved.api)
          const meal = meals.find((item) => item.mealName.toLowerCase() === opts.meal.toLowerCase())
          if (!meal) {
            const validNames = meals.map((item) => item.mealName).join(', ')
            logError(ctx, `Unknown meal: "${opts.meal}". Valid meals: ${validNames}`)
            process.exitCode = 2
            return
          }

          await client.addQuickFood({
            name: opts.name.trim(),
            calories: cal,
            protein,
            carbs,
            fat,
            mealName: meal.mealName,
            mealId: meal.mealID,
            mealOrder: meal.mealOrder,
            date: resolved.api,
          })

          // Fetch updated daily
          const updated = await client.getDailyMeals(resolved.api)

          if (ctx.output.format === 'json') {
            output(ctx, {
              success: true,
              added: {
                name: opts.name.trim(),
                calories: cal,
                protein,
                carbs,
                fat,
                mealName: meal.mealName,
              },
              daily: updated,
            })
          } else {
            logSuccess(ctx, `Quick-added "${opts.name.trim()}" to ${meal.mealName}`)
            const dt = updated.dailyTotals
            writeData(`Daily: ${dt.calories} kcal | ${dt.protein}P ${dt.carbs}C ${dt.fat}F`)
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          logError(ctx, message)
          process.exitCode = 1
        }
      },
    )
}
