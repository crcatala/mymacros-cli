import ora from 'ora'
import type { CliContext } from './context.js'
import { getErrorStream } from './output.js'

const SPINNER_DELAY_MS = 100

/** Run an operation with a delayed TTY-only spinner, keeping stdout pipe-safe. */
export async function withSpinner<T>(
  ctx: CliContext,
  text: string,
  operation: () => Promise<T>,
): Promise<T> {
  if (!ctx.isStderrTty || ctx.output.debug || ctx.output.quiet) return operation()

  let spinner: ReturnType<typeof ora> | undefined
  const timer = setTimeout(() => {
    spinner = ora({ text, stream: getErrorStream() as NodeJS.WriteStream }).start()
  }, SPINNER_DELAY_MS)

  try {
    return await operation()
  } finally {
    clearTimeout(timer)
    spinner?.stop()
  }
}
