import { describe, expect, it } from 'vitest'
import type { CliContext } from '../src/cli/context.js'
import { renderTable } from '../src/cli/table.js'

const ctx: CliContext = {
  isTty: true,
  isStderrTty: true,
  output: { color: false, format: 'table', debug: false, quiet: false },
  colors: {
    section: (text) => text,
    command: (text) => text,
    option: (text) => text,
    muted: (text) => text,
    success: (text) => text,
    warning: (text) => text,
    error: (text) => text,
    number: (text) => text,
  },
  prefix: { ok: '', warn: '', err: '', info: '' },
}

describe('renderTable', () => {
  it('aligns rows with headers', () => {
    expect(
      renderTable(
        ctx,
        ['ID', 'Food'],
        [
          ['1', 'Egg'],
          ['20', 'Chicken'],
        ],
      ),
    ).toBe('ID  Food   \n──  ───────\n1   Egg    \n20  Chicken')
  })

  it('returns an empty string for no rows', () => {
    expect(renderTable(ctx, ['ID'], [])).toBe('')
  })
})
