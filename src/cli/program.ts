import { Command, CommanderError } from 'commander'
import { registerAddCommand } from '../commands/add.js'
import { registerBrowseCommand } from '../commands/browse.js'
import { registerCopyMealCommand } from '../commands/copy-meal.js'
import { registerDailyCommand } from '../commands/daily.js'
import { registerDatesCommand } from '../commands/dates.js'
import { registerDeleteMealCommand } from '../commands/delete-meal.js'
import { registerFoodCommand } from '../commands/food.js'
import { registerLoginCommand } from '../commands/login.js'
import { registerNoteCommand } from '../commands/note.js'
import { registerRemoveCommand } from '../commands/remove.js'
import { registerSearchCommand } from '../commands/search.js'
import { registerStarCommands } from '../commands/star.js'
import { registerUpdateCommand } from '../commands/update.js'
import type { CliContext } from './context.js'
import { configureStyledHelp } from './help.js'
import { addOutputOptions } from './options.js'

const VERSION = '0.1.0'

export function createProgram(ctx: CliContext): Command {
  const program = new Command()

  // Banner
  program.addHelpText(
    'beforeAll',
    () =>
      `${ctx.colors.section('mymacros')} ${ctx.colors.muted(`v${VERSION}`)} — ${ctx.colors.muted('GetMyMacros CLI (agent-optimized)')}\n`,
  )

  // Helper for example formatting
  const ex = (cmd: string, desc: string) =>
    `  ${ctx.colors.command(cmd)}\n    ${ctx.colors.muted(desc)}`

  // Examples & reference after help
  program.addHelpText(
    'afterAll',
    () => `
${ctx.colors.section('Examples — Getting Started')}
${ex('mymacros login', 'Authenticate interactively (or set MYMACROS_USER / MYMACROS_PASSWORD)')}
${ex('mymacros daily', "Show today's meals and macros")}
${ex('mymacros daily yesterday', "Show yesterday's meals")}
${ex('mymacros daily 2026-01-15', 'Show meals for a specific date')}

${ctx.colors.section('Examples — Finding Food')}
${ex('mymacros search "chicken breast"', 'Search the food database (default: 25 results per section)')}
${ex('mymacros search "eggs" --limit 5', 'Search with fewer results')}
${ex('mymacros food 164298', 'Show full nutrition details for a food')}
${ex('mymacros food -- -2288', 'Show a custom food (use -- before negative IDs)')}
${ex('mymacros browse custom', 'Browse your custom foods & favorites')}
${ex('mymacros browse recent', 'Browse recently used foods')}
${ex('mymacros browse types', 'List food type categories')}
${ex('mymacros browse types Chicken', 'Browse foods in a category')}

${ctx.colors.section('Examples — Tracking')}
${ex('mymacros add 164298 --meal Breakfast --serving 2', 'Add a food to a meal')}
${ex('mymacros add-quick --name "Protein shake" --cal 200 --protein 30 --carbs 10 --fat 3', 'Quick-add by macros')}
${ex('mymacros update 668 --serving 3', 'Change serving size (uniqueId from daily output)')}
${ex('mymacros update 668 --meal Lunch', 'Move a food to another meal')}
${ex('mymacros remove 668', 'Remove a food entry')}
${ex('mymacros copy-meal Breakfast --to-date tomorrow', 'Copy a meal to another date')}
${ex('mymacros copy-meal Lunch --to-date 2026-02-20 --to-meal Dinner', 'Copy to a different meal')}
${ex('mymacros delete-meal Lunch', 'Delete all entries from a meal')}

${ctx.colors.section('Examples — Other')}
${ex('mymacros note "Felt great today"', 'Add a day note')}
${ex('mymacros note "Light meal" --meal Breakfast', 'Add a meal note')}
${ex('mymacros star 164298', 'Add food to favorites')}
${ex('mymacros unstar 164298', 'Remove food from favorites')}
${ex('mymacros dates --limit 10', 'List recent dates with logged data')}

${ctx.colors.section('Output Modes')}
  ${ctx.colors.option('--json')}       ${ctx.colors.muted('Structured JSON (default when piped to another program)')}
  ${ctx.colors.option('--plain')}      ${ctx.colors.muted('Human-readable text (default in terminal)')}
  ${ctx.colors.option('--table')}      ${ctx.colors.muted('Aligned tables for list commands')}
  ${ctx.colors.option('--quiet')}      ${ctx.colors.muted('Minimal output')}
  ${ctx.colors.option('--debug')}      ${ctx.colors.muted('Show HTTP request/response details')}

${ctx.colors.section('Environment Variables')}
  ${ctx.colors.option('MYMACROS_USER')}        ${ctx.colors.muted('Username for auto-login')}
  ${ctx.colors.option('MYMACROS_PASSWORD')}    ${ctx.colors.muted('Password for auto-login')}
  ${ctx.colors.option('NO_COLOR')}             ${ctx.colors.muted('Disable colors')}

${ctx.colors.section('Agent Usage Notes')}
  ${ctx.colors.muted('• JSON output is automatic when piped (non-TTY). Use --json to force it.')}
  ${ctx.colors.muted('• All IDs (foodId, uniqueId) are included in output for command chaining.')}
  ${ctx.colors.muted('• uniqueId changes on every update — always re-read daily after mutations.')}
  ${ctx.colors.muted('• Nutrition values in daily output are pre-multiplied by serving size.')}
  ${ctx.colors.muted('• Dates accept: YYYY-MM-DD, today, yesterday, tomorrow.')}
`,
  )

  program
    .name('mymacros')
    .description('Unofficial GetMyMacros CLI — optimized for AI agent use')
    .version(VERSION)
    .showHelpAfterError(true)

  addOutputOptions(program)

  // Register commands
  registerLoginCommand(program, ctx)
  registerDailyCommand(program, ctx)
  registerSearchCommand(program, ctx)
  registerFoodCommand(program, ctx)
  registerBrowseCommand(program, ctx)
  registerDatesCommand(program, ctx)
  registerAddCommand(program, ctx)
  registerRemoveCommand(program, ctx)
  registerUpdateCommand(program, ctx)
  registerCopyMealCommand(program, ctx)
  registerDeleteMealCommand(program, ctx)
  registerNoteCommand(program, ctx)
  registerStarCommands(program, ctx)

  configureStyledHelp(program, ctx)

  // Catch unknown commands with a concise suggestion; do not flood stderr with help text.
  program.on('command:*', ([unknown]) => {
    const known = program.commands.map((c) => c.name())
    const suggestion =
      known.find((name) => name.startsWith(unknown.slice(0, 2))) ??
      known.find((name) => unknown.startsWith(name))
    throw new CommanderError(
      1,
      'commander.unknownCommand',
      `${ctx.colors.error('Unknown command:')} ${ctx.colors.command(unknown)}` +
        (suggestion
          ? `\n${ctx.colors.muted(`Did you mean ${ctx.colors.command(suggestion)}?`)}`
          : ''),
    )
  })

  return program
}
