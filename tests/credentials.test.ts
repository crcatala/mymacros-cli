import { mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

const keytar = vi.hoisted(() => ({ deletePassword: vi.fn() }))
vi.mock('keytar', () => ({ default: keytar }))

const tempDirs: string[] = []

async function loadCredentials() {
  const dir = mkdtempSync(join(tmpdir(), 'mymacros-credentials-test-'))
  tempDirs.push(dir)
  vi.resetModules()
  vi.stubEnv('XDG_CONFIG_HOME', dir)
  return { dir, ...(await import('../src/credentials.js')) }
}

afterEach(() => {
  vi.unstubAllEnvs()
  vi.useRealTimers()
  keytar.deletePassword.mockReset()
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

describe('config-backed session storage', () => {
  it('stores, reports, loads, and clears a protected config session', async () => {
    const { dir, saveStoredSession, getStoredSessionInfo, loadStoredSession, clearStoredSession } =
      await loadCredentials()
    keytar.deletePassword.mockResolvedValue(false)
    await expect(saveStoredSession('session-id', 'config')).resolves.toBe('config')
    expect(keytar.deletePassword).toHaveBeenCalledWith('mymacros-cli', 'session')

    const file = join(dir, 'mymacros-cli', 'session.json')
    expect(JSON.parse(readFileSync(file, 'utf8'))).toMatchObject({
      sessionId: 'session-id',
      storage: 'config',
    })
    expect(statSync(file).mode & 0o777).toBe(0o600)
    await expect(getStoredSessionInfo()).resolves.toMatchObject({
      storage: 'config',
      sessionFresh: true,
    })
    await expect(loadStoredSession()).resolves.toMatchObject({ sessionId: 'session-id' })

    await clearStoredSession()
    await expect(loadStoredSession()).resolves.toBeNull()
  })

  it('treats expired and malformed stored data as unavailable', async () => {
    const {
      dir,
      saveStoredSession,
      getStoredSessionInfo,
      loadStoredSession,
      isSessionFresh,
      SESSION_MAX_AGE_MS,
    } = await loadCredentials()
    keytar.deletePassword.mockResolvedValue(false)
    await saveStoredSession('session-id', 'config')
    const file = join(dir, 'mymacros-cli', 'session.json')
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-02-17T12:00:00.000Z'))
    expect(isSessionFresh(Date.now() - SESSION_MAX_AGE_MS - 1)).toBe(false)
    expect(isSessionFresh(Date.now() - SESSION_MAX_AGE_MS)).toBe(true)

    await import('node:fs').then(({ writeFileSync }) => writeFileSync(file, '{not-json'))
    await expect(getStoredSessionInfo()).resolves.toBeNull()
    await expect(loadStoredSession()).resolves.toBeNull()
  })
})
