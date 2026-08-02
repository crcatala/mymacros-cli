import type { Command } from 'commander'
import { createClient } from '../cli/client.js'
import type { CliContext } from '../cli/context.js'
import { logError, logSuccess, output } from '../cli/output.js'
import { promptInput, promptPassword } from '../cli/prompt.js'

export function registerLoginCommand(program: Command, ctx: CliContext): void {
  program
    .command('login')
    .description('Authenticate with GetMyMacros')
    .option(
      '--use-config',
      'Store the session in a protected config file instead of the system keyring',
    )
    .action(async (opts: { useConfig?: boolean }) => {
      const env = process.env
      let username = env.MYMACROS_USER
      let password = env.MYMACROS_PASSWORD

      // Prompt interactively if not provided via env
      if (!username) {
        if (!process.stdin.isTTY) {
          logError(ctx, 'No credentials. Set MYMACROS_USER and MYMACROS_PASSWORD env vars.')
          process.exitCode = 1
          return
        }
        username = await promptInput('Username: ')
      }
      if (!password) {
        if (!process.stdin.isTTY) {
          logError(ctx, 'No credentials. Set MYMACROS_USER and MYMACROS_PASSWORD env vars.')
          process.exitCode = 1
          return
        }
        password = await promptPassword('Password: ')
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
          logSuccess(
            ctx,
            `Logged in as ${response.uname ?? username} (session cached in ${location})`,
          )
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        logError(ctx, message)
        process.exitCode = 1
      }
    })
}
