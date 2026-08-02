import type { Command } from 'commander'
import { createClient } from '../cli/client.js'
import type { CliContext } from '../cli/context.js'
import { logError, logSuccess, logWarning, output } from '../cli/output.js'
import { promptInput, promptPassword } from '../cli/prompt.js'
import { clearStoredSession, getStoredSessionInfo } from '../credentials.js'

type LoginOptions = { useConfig?: boolean }

async function login(ctx: CliContext, opts: LoginOptions): Promise<void> {
  const env = process.env
  let username = env.MYMACROS_USER
  let password = env.MYMACROS_PASSWORD

  if (!username || !password) {
    if (!process.stdin.isTTY) {
      logError(ctx, 'No credentials. Set MYMACROS_USER and MYMACROS_PASSWORD env vars.')
      process.exitCode = 1
      return
    }
    username ??= await promptInput('Username: ')
    password ??= await promptPassword('Password: ')
  }

  if (!username || !password) {
    logError(ctx, 'Username and password are required.')
    process.exitCode = 1
    return
  }

  const client = createClient(ctx, env, {
    sessionStorage: opts.useConfig ? 'config' : 'keyring',
  })

  try {
    const response = await client.login(username, password)
    if (ctx.output.format === 'json') {
      output(ctx, {
        success: true,
        username: response.uname ?? username,
        email: response.email,
      })
    } else {
      const location =
        client.lastSessionStorage === 'keyring' ? 'system keyring' : 'protected config file'
      logSuccess(ctx, `Logged in as ${response.uname ?? username} (session cached in ${location})`)
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    logError(ctx, message)
    process.exitCode = 1
  }
}

function addLoginCommand(program: Command, ctx: CliContext): void {
  program
    .command('login')
    .description('Authenticate with GetMyMacros')
    .option(
      '--use-config',
      'Store the session in a protected config file instead of the system keyring',
    )
    .action((opts: LoginOptions) => login(ctx, opts))
}

export function registerAuthCommands(program: Command, ctx: CliContext): void {
  const auth = program
    .command('auth')
    .description('Manage authentication')
    .action(function (this: Command) {
      this.help()
    })

  addLoginCommand(auth, ctx)

  auth
    .command('status')
    .description('Show local credential status without contacting GetMyMacros')
    .action(async () => {
      const info = await getStoredSessionInfo()
      const usesEnv = Boolean(process.env.MYMACROS_USER && process.env.MYMACROS_PASSWORD)
      const source = usesEnv ? 'environment' : info?.storage
      const configured = Boolean(source)

      if (ctx.output.format === 'json') {
        output(ctx, { configured, source: source ?? null })
        if (!configured) process.exitCode = 1
        return
      }

      if (!configured) {
        logError(
          ctx,
          'No credentials configured. Run "mymacros auth login" or set MYMACROS_USER and MYMACROS_PASSWORD.',
        )
        process.exitCode = 1
        return
      }

      const location =
        source === 'environment'
          ? 'environment variables'
          : source === 'keyring'
            ? 'the system keyring'
            : 'a protected config file'
      logSuccess(ctx, `Credentials are configured in ${location}.`)
    })

  auth
    .command('clear')
    .description('Remove the locally stored session (environment variables are unchanged)')
    .action(async () => {
      await clearStoredSession()
      if (ctx.output.format === 'json') {
        output(ctx, { success: true })
      } else {
        logSuccess(ctx, 'Locally stored session cleared.')
        if (process.env.MYMACROS_USER || process.env.MYMACROS_PASSWORD) {
          logWarning(ctx, 'MYMACROS_USER or MYMACROS_PASSWORD is still set in the environment.')
        }
      }
    })

  // Keep the original command as a compatibility alias while users migrate.
  addLoginCommand(program, ctx)
}
