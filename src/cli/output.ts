import type { CliContext } from './context.js'

let stdoutStream: NodeJS.WritableStream = process.stdout
let stderrStream: NodeJS.WritableStream = process.stderr

export function setOutputStream(stdout: NodeJS.WritableStream, stderr: NodeJS.WritableStream) {
  stdoutStream = stdout
  stderrStream = stderr
}

export function getErrorStream(): NodeJS.WritableStream {
  return stderrStream
}

export function writeData(message: string): void {
  stdoutStream.write(`${message}\n`)
}

export function writeError(message: string): void {
  stderrStream.write(`${message}\n`)
}

/** Write data to stdout. JSON or plain text depending on format. */
export function output<T>(
  ctx: CliContext,
  data: T,
  plainFormatter?: (data: T) => string,
  tableFormatter?: (data: T) => string,
): void {
  if (ctx.output.format === 'json') {
    writeData(JSON.stringify(data, null, 2))
  } else if (ctx.output.format === 'table' && tableFormatter) {
    writeData(tableFormatter(data))
  } else if (plainFormatter) {
    writeData(plainFormatter(data))
  } else {
    writeData(JSON.stringify(data, null, 2))
  }
}

export function logSuccess(ctx: CliContext, message: string): void {
  if (ctx.output.quiet) return
  writeError(`${ctx.colors.success(ctx.prefix.ok)}${message}`)
}

export function logWarning(ctx: CliContext, message: string): void {
  if (ctx.output.quiet) return
  writeError(`${ctx.colors.warning(ctx.prefix.warn)}${message}`)
}

export function logError(ctx: CliContext, message: string): void {
  writeError(`${ctx.colors.error(ctx.prefix.err)}${message}`)
}

export function logInfo(ctx: CliContext, message: string): void {
  if (ctx.output.quiet) return
  writeError(`${ctx.colors.muted(ctx.prefix.info)}${message}`)
}

export function logDebug(ctx: CliContext, message: string): void {
  if (!ctx.output.debug) return
  writeError(`${ctx.colors.muted('[debug]')} ${message}`)
}
