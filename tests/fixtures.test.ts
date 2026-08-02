import { execFileSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'

describe('synthetic fixtures', () => {
  it('are exactly reproduced by the deterministic generator', () => {
    expect(() => {
      execFileSync(process.execPath, ['scripts/generate-fixtures.mjs', '--check'], {
        cwd: process.cwd(),
        stdio: 'pipe',
      })
    }).not.toThrow()
  })
})
