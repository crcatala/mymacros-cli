import { type ClientOptions, MyMacrosClient } from '../client.js'
import type { CliContext } from './context.js'
import { logDebug } from './output.js'
import { withSpinner } from './spinner.js'

/** Create a client wired to the CLI's status stream, debug mode, and spinner. */
export function createClient(
  ctx: CliContext,
  env: Record<string, string | undefined> = process.env,
  options: Omit<ClientOptions, 'debug' | 'onDebug' | 'withProgress'> = {},
): MyMacrosClient {
  return new MyMacrosClient(env, {
    ...options,
    debug: ctx.output.debug,
    onDebug: (message) => logDebug(ctx, message),
    withProgress: (label, operation) => withSpinner(ctx, label, operation),
  })
}
