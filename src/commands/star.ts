import type { Command } from 'commander'
import { createClient } from '../cli/client.js'
import type { CliContext } from '../cli/context.js'
import { logError, logSuccess, output } from '../cli/output.js'

function registerStarAction(
  program: Command,
  ctx: CliContext,
  commandName: string,
  action: 'add' | 'remove',
): void {
  program
    .command(commandName)
    .description(`${action === 'add' ? 'Star' : 'Unstar'} a food (add/remove from favorites)`)
    .argument('<food_id>', 'Food ID')
    .action(async (foodId: string) => {
      if (!foodId.trim()) {
        logError(ctx, 'Food ID is required.')
        process.exitCode = 2
        return
      }

      const client = createClient(ctx)

      try {
        await client.toggleStar(foodId.trim(), action)

        if (ctx.output.format === 'json') {
          output(ctx, { success: true, foodId: foodId.trim(), starred: action === 'add' })
        } else {
          const verb = action === 'add' ? 'Starred' : 'Unstarred'
          logSuccess(ctx, `${verb} food ${foodId.trim()}`)
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        logError(ctx, message)
        process.exitCode = 1
      }
    })
}

export function registerStarCommands(program: Command, ctx: CliContext): void {
  registerStarAction(program, ctx, 'star', 'add')
  registerStarAction(program, ctx, 'unstar', 'remove')
}
