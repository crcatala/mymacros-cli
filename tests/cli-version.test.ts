import { PassThrough } from 'node:stream'
import { afterEach, describe, expect, it, vi } from 'vitest'

const meta = vi.hoisted(() => ({
  runUpdate: vi.fn(),
  versionLine: vi.fn(() => 'mymacros 9.9.9 (abc1234 2026-01-02)'),
  versionDetails: vi.fn(() => ({
    version: '9.9.9',
    commit: 'abc1234def5678',
    date: '2026-01-02',
    dirty: false,
    install: 'checkout',
    path: '/tmp/mymacros-cli',
  })),
}))

vi.mock('../src/cli-meta.js', () => meta)

import { runCli } from '../src/run.js'

async function run(args: string[]) {
  const stdout = new PassThrough()
  const stderr = new PassThrough()
  let out = ''
  let err = ''
  stdout.on('data', (chunk) => {
    out += chunk
  })
  stderr.on('data', (chunk) => {
    err += chunk
  })
  process.exitCode = undefined
  await runCli(args, { env: {}, stdout, stderr })
  return { out, err, exitCode: process.exitCode ?? 0 }
}

afterEach(() => {
  meta.runUpdate.mockReset()
  process.exitCode = undefined
})

describe('--version', () => {
  it.each([['--version'], ['-V']])('%s prints the standard version line', async (flag) => {
    const result = await run([flag])
    expect(result.exitCode).toBe(0)
    expect(result.out.trim()).toBe('mymacros 9.9.9 (abc1234 2026-01-02)')
  })
})

describe('version command', () => {
  it('prints the details as key: value lines', async () => {
    const result = await run(['version', '--plain'])
    expect(result.exitCode).toBe(0)
    expect(result.out).toContain('version: 9.9.9')
    expect(result.out).toContain('install: checkout')
  })

  it('prints one JSON object with --json', async () => {
    const result = await run(['version', '--json'])
    expect(result.exitCode).toBe(0)
    expect(JSON.parse(result.out)).toMatchObject({ version: '9.9.9', install: 'checkout' })
  })
})

describe('update command', () => {
  it.each([
    [0, 0],
    [1, 1],
    [2, 2],
  ])('with --check, exits with the status runUpdate returns (%i)', async (status, expected) => {
    meta.runUpdate.mockReturnValue(status)
    const result = await run(['update', '--check'])
    expect(meta.runUpdate).toHaveBeenCalledWith('mymacros', { check: true, force: undefined })
    expect(result.exitCode).toBe(expected)
  })

  it('passes --force to the self-update', async () => {
    meta.runUpdate.mockReturnValue(0)
    const result = await run(['update', '--force'])
    expect(meta.runUpdate).toHaveBeenCalledWith('mymacros', { check: undefined, force: true })
    expect(result.exitCode).toBe(0)
  })

  it('still updates a food entry when an ID is given', async () => {
    const result = await run(['update', 'entry-1'])
    expect(result.exitCode).toBe(2)
    expect(result.err).toContain('Provide at least one')
    expect(meta.runUpdate).not.toHaveBeenCalled()
  })
})
