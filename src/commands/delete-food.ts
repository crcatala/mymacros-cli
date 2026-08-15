import type { Command } from 'commander'
import { createClient } from '../cli/client.js'
import type { CliContext } from '../cli/context.js'
import { logError, logSuccess, output } from '../cli/output.js'

export function registerDeleteFoodCommand(program: Command, ctx: CliContext): void {
  program
    .command('delete-food')
    .description('Delete a custom food definition')
    .argument('<food_id>', 'Custom food ID (usually negative)')
    .action(async (foodId: string) => {
      if (!foodId.trim()) {
        logError(ctx, 'Food ID is required.')
        process.exitCode = 2
        return
      }
      try {
        const result = await createClient(ctx).deleteCustomFood({ foodId: foodId.trim() })
        output(
          ctx,
          { ...result, foodId: foodId.trim() },
          () => `Deleted custom food ${foodId.trim()}`,
        )
        if (ctx.output.format !== 'json') logSuccess(ctx, `Deleted custom food ${foodId.trim()}`)
      } catch (error) {
        logError(ctx, error instanceof Error ? error.message : String(error))
        process.exitCode = 1
      }
    })
}
