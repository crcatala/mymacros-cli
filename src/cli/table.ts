import type { CliContext } from './context.js'

const ansiPattern = new RegExp(`${String.fromCharCode(27)}\\[[0-?]*[ -/]*[@-~]`, 'g')

function stripAnsi(text: string): string {
  return text.replace(ansiPattern, '')
}

/** Render a compact, ANSI-safe table for terminal output. */
export function renderTable(ctx: CliContext, headers: string[], rows: string[][]): string {
  if (rows.length === 0) return ''

  const widths = headers.map((header, index) =>
    Math.max(stripAnsi(header).length, ...rows.map((row) => stripAnsi(row[index] ?? '').length)),
  )
  const line = (cells: string[]) =>
    cells
      .map(
        (cell, index) =>
          `${cell}${' '.repeat(Math.max(0, widths[index] - stripAnsi(cell).length))}`,
      )
      .join('  ')

  return [
    line(headers.map((header) => ctx.colors.command(header))),
    widths.map((width) => ctx.colors.muted('─'.repeat(width))).join('  '),
    ...rows.map(line),
  ].join('\n')
}
