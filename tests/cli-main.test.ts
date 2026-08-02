import { PassThrough } from 'node:stream'
import { afterEach, describe, expect, it, vi } from 'vitest'

const runCli = vi.hoisted(() => vi.fn())
vi.mock('../src/run.js', () => ({ runCli }))

import { UsageError } from '../src/cli/errors.js'
import { runCliMain } from '../src/cli-main.js'

function streams() {
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
  return {
    stdout,
    stderr,
    get out() {
      return out
    },
    get err() {
      return err
    },
  }
}

afterEach(() => {
  runCli.mockReset()
  vi.restoreAllMocks()
})

function suppressSignalHandlers() {
  vi.spyOn(process, 'on').mockImplementation(() => process)
}

describe('runCliMain', () => {
  it('delegates to runCli without setting an exit code on success', async () => {
    suppressSignalHandlers()
    const io = streams()
    const setExitCode = vi.fn()
    await runCliMain({ argv: ['daily'], env: {}, ...io, exit: vi.fn(), setExitCode })
    expect(runCli).toHaveBeenCalledWith(
      ['daily'],
      expect.objectContaining({ stdout: io.stdout, stderr: io.stderr }),
    )
    expect(setExitCode).not.toHaveBeenCalled()
  })

  it('serializes typed errors for JSON callers', async () => {
    suppressSignalHandlers()
    runCli.mockRejectedValue(new UsageError('bad input'))
    const io = streams()
    const setExitCode = vi.fn()
    await runCliMain({ argv: ['daily', '--json'], env: {}, ...io, exit: vi.fn(), setExitCode })
    expect(JSON.parse(io.err)).toEqual({ error: true, code: 'USAGE_ERROR', message: 'bad input' })
    expect(setExitCode).toHaveBeenCalledWith(2)
  })

  it('writes ordinary error messages and uses exit code 1', async () => {
    suppressSignalHandlers()
    runCli.mockRejectedValue(new Error('network failed'))
    const io = streams()
    const setExitCode = vi.fn()
    await runCliMain({ argv: ['daily'], env: {}, ...io, exit: vi.fn(), setExitCode })
    expect(io.err).toBe('network failed\n')
    expect(setExitCode).toHaveBeenCalledWith(1)
  })
})
