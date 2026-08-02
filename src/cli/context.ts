import kleur from 'kleur'

export type OutputFormat = 'json' | 'plain' | 'table'

export type OutputConfig = {
  color: boolean
  format: OutputFormat
  debug: boolean
  quiet: boolean
}

export type CliContext = {
  isTty: boolean
  isStderrTty: boolean
  output: OutputConfig
  colors: {
    section: (t: string) => string
    command: (t: string) => string
    option: (t: string) => string
    muted: (t: string) => string
    success: (t: string) => string
    warning: (t: string) => string
    error: (t: string) => string
    number: (t: string) => string
  }
  prefix: { ok: string; warn: string; err: string; info: string }
}

export function createContext(argv: string[], env: Record<string, string | undefined>): CliContext {
  const isTty = process.stdout.isTTY ?? false
  const isStderrTty = process.stderr.isTTY ?? false
  const noColor = argv.includes('--no-color') || env.NO_COLOR !== undefined
  const debug = argv.includes('--debug')
  const quiet = argv.includes('--quiet') || argv.includes('-q')

  let format: OutputFormat = isTty ? 'plain' : 'json'
  if (argv.includes('--json')) format = 'json'
  else if (argv.includes('--table')) format = 'table'
  else if (argv.includes('--plain')) format = 'plain'

  const color = isTty && !noColor && format !== 'json'
  kleur.enabled = color

  const style =
    (styler: (text: string) => string) =>
    (text: string): string =>
      color ? styler(text) : text

  return {
    isTty,
    isStderrTty,
    output: { color, format, debug, quiet },
    colors: {
      section: style((t) => kleur.bold().white(t)),
      command: style((t) => kleur.bold().cyan(t)),
      option: style((t) => kleur.cyan(t)),
      muted: style((t) => kleur.gray(t)),
      success: style((t) => kleur.green(t)),
      warning: style((t) => kleur.yellow(t)),
      error: style((t) => kleur.red(t)),
      number: style((t) => kleur.yellow(t)),
    },
    prefix: color
      ? { ok: '✓ ', warn: '⚠ ', err: '✗ ', info: 'ℹ ' }
      : { ok: '[OK] ', warn: '[WARN] ', err: '[ERR] ', info: '[INFO] ' },
  }
}
