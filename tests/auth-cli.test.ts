import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

const configDirs: string[] = []

function runCli(args: string[], env: Record<string, string | undefined> = {}) {
  const configDir = mkdtempSync(join(tmpdir(), 'mymacros-auth-test-'))
  configDirs.push(configDir)
  const result = spawnSync(process.execPath, ['--import', 'tsx', 'src/cli.ts', ...args], {
    cwd: process.cwd(),
    env: { ...process.env, ...env, XDG_CONFIG_HOME: configDir },
    encoding: 'utf8',
  })

  return { ...result, configDir }
}

afterEach(() => {
  for (const configDir of configDirs.splice(0)) rmSync(configDir, { recursive: true, force: true })
})

describe('auth CLI', () => {
  it('reports absent credentials and a non-applicable cached-session status', () => {
    const result = runCli(['auth', 'status'], { MYMACROS_USER: '', MYMACROS_PASSWORD: '' })

    expect(result.status).toBe(1)
    expect(JSON.parse(result.stdout)).toMatchObject({
      configured: false,
      sessionFresh: null,
      source: null,
    })
  })

  it('reports environment credentials without claiming a cached session', () => {
    const result = runCli(['auth', 'status'], {
      MYMACROS_USER: 'test-user',
      MYMACROS_PASSWORD: 'test-password',
    })

    expect(result.status).toBe(0)
    expect(JSON.parse(result.stdout)).toMatchObject({
      configured: true,
      sessionFresh: null,
      source: 'environment',
    })
  })

  it('reports whether a config-file cached session is fresh', () => {
    const result = runCli(['auth', 'status'], { MYMACROS_USER: '', MYMACROS_PASSWORD: '' })
    const sessionDir = join(result.configDir, 'mymacros-cli')
    mkdirSync(sessionDir)
    writeFileSync(
      join(sessionDir, 'session.json'),
      JSON.stringify({
        storage: 'config',
        sessionId: 'session',
        timestamp: Date.now() - 51 * 60 * 1000,
      }),
    )

    const status = spawnSync(
      process.execPath,
      ['--import', 'tsx', 'src/cli.ts', 'auth', 'status'],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          MYMACROS_USER: '',
          MYMACROS_PASSWORD: '',
          XDG_CONFIG_HOME: result.configDir,
        },
        encoding: 'utf8',
      },
    )

    expect(status.status).toBe(0)
    expect(JSON.parse(status.stdout)).toMatchObject({
      configured: true,
      sessionFresh: false,
      source: 'config',
    })
  })

  it('clears config-file sessions and retains the login alias', () => {
    const result = runCli(['auth', 'clear'], { MYMACROS_USER: '', MYMACROS_PASSWORD: '' })
    const sessionDir = join(result.configDir, 'mymacros-cli')
    mkdirSync(sessionDir)
    const sessionFile = join(sessionDir, 'session.json')
    writeFileSync(
      sessionFile,
      JSON.stringify({ storage: 'config', sessionId: 'session', timestamp: Date.now() }),
    )

    const testEnv = {
      ...process.env,
      MYMACROS_USER: '',
      MYMACROS_PASSWORD: '',
      XDG_CONFIG_HOME: result.configDir,
    }
    const clear = spawnSync(process.execPath, ['--import', 'tsx', 'src/cli.ts', 'auth', 'clear'], {
      cwd: process.cwd(),
      env: testEnv,
      encoding: 'utf8',
    })
    const loginHelp = spawnSync(
      process.execPath,
      ['--import', 'tsx', 'src/cli.ts', 'login', '--help'],
      {
        cwd: process.cwd(),
        env: testEnv,
        encoding: 'utf8',
      },
    )

    expect(clear.status).toBe(0)
    expect(JSON.parse(clear.stdout)).toEqual({ success: true })
    expect(existsSync(sessionFile)).toBe(false)
    expect(loginHelp.status).toBe(0)
    expect(loginHelp.stdout).toContain('Usage: mymacros login')
  })
})
