import { chmodSync, existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { SessionData } from './types.js'

const SERVICE_NAME = 'mymacros-cli'
const ACCOUNT_NAME = 'session'
const CONFIG_DIR = join(process.env.XDG_CONFIG_HOME ?? join(homedir(), '.config'), 'mymacros-cli')
const SESSION_FILE = join(CONFIG_DIR, 'session.json')

export type SessionStorage = 'keyring' | 'config'

export const SESSION_MAX_AGE_MS = 50 * 60 * 1000

export type StoredSessionInfo = {
  storage: SessionStorage
  timestamp: number
  sessionFresh: boolean
}

export function isSessionFresh(timestamp: number): boolean {
  return Date.now() - timestamp <= SESSION_MAX_AGE_MS
}

export type SessionStore = {
  load: () => Promise<SessionData | null>
  save: (sessionId: string, storage?: SessionStorage) => Promise<SessionStorage>
  clear: () => Promise<void>
}

type StoredSession = Omit<SessionData, 'sessionId'> & {
  storage?: SessionStorage
  sessionId?: string
}

async function getKeytar() {
  try {
    const keytar = await import('keytar')
    return keytar.default
  } catch {
    throw new Error(
      'Unable to access the system keyring. On Linux, install libsecret or rerun login with --use-config to store the session in a protected config file.',
    )
  }
}

function ensureConfigDir(): void {
  mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 })
  chmodSync(CONFIG_DIR, 0o700)
}

function readStoredSession(): StoredSession | null {
  try {
    if (!existsSync(SESSION_FILE)) return null
    ensureConfigDir()
    chmodSync(SESSION_FILE, 0o600)
    return JSON.parse(readFileSync(SESSION_FILE, 'utf-8')) as StoredSession
  } catch {
    return null
  }
}

function writeStoredSession(data: StoredSession): void {
  ensureConfigDir()
  writeFileSync(SESSION_FILE, JSON.stringify(data), { encoding: 'utf-8', mode: 0o600 })
  chmodSync(SESSION_FILE, 0o600)
}

/** Returns local session metadata without reading or exposing the session ID. */
export async function getStoredSessionInfo(): Promise<StoredSessionInfo | null> {
  const stored = readStoredSession()
  if (!stored?.timestamp) return null
  return {
    storage: stored.storage ?? (stored.sessionId ? 'config' : 'keyring'),
    timestamp: stored.timestamp,
    sessionFresh: isSessionFresh(stored.timestamp),
  }
}

/**
 * Loads a session from the configured storage. Legacy session files that
 * contain a sessionId are treated as the config-file fallback.
 */
export async function loadStoredSession(): Promise<SessionData | null> {
  const stored = readStoredSession()
  if (!stored || !stored.timestamp) return null

  if ((stored.storage ?? (stored.sessionId ? 'config' : 'keyring')) === 'config') {
    return stored.sessionId ? { sessionId: stored.sessionId, timestamp: stored.timestamp } : null
  }

  try {
    const sessionId = await (await getKeytar()).getPassword(SERVICE_NAME, ACCOUNT_NAME)
    return sessionId ? { sessionId, timestamp: stored.timestamp } : null
  } catch {
    return null
  }
}

/** Store the session ID in the OS keyring by default, or a 0600 config file when explicitly requested. */
export async function saveStoredSession(
  sessionId: string,
  storage: SessionStorage = 'keyring',
): Promise<SessionStorage> {
  const timestamp = Date.now()

  if (storage === 'config') {
    writeStoredSession({ sessionId, timestamp, storage })
    try {
      await (await getKeytar()).deletePassword(SERVICE_NAME, ACCOUNT_NAME)
    } catch {
      // The protected config fallback is already saved; stale keyring data is harmless.
    }
    return storage
  }

  try {
    await (await getKeytar()).setPassword(SERVICE_NAME, ACCOUNT_NAME, sessionId)
    writeStoredSession({ timestamp, storage })
    return storage
  } catch {
    // Headless Linux environments often lack a Secret Service; retain the
    // session in the protected (0600) fallback instead of losing login state.
    writeStoredSession({ sessionId, timestamp, storage: 'config' })
    return 'config'
  }
}

/** Remove local session metadata and the matching keyring entry. */
export async function clearStoredSession(): Promise<void> {
  const stored = readStoredSession()

  try {
    if (existsSync(SESSION_FILE)) unlinkSync(SESSION_FILE)
  } catch (error) {
    throw new Error(`Unable to remove the local session file: ${errorMessage(error)}`)
  }

  // No metadata means no session created by this CLI; config sessions are self-contained.
  if (!stored || stored.storage === 'config' || (!stored.storage && stored.sessionId)) return

  try {
    await (await getKeytar()).deletePassword(SERVICE_NAME, ACCOUNT_NAME)
  } catch (error) {
    throw new Error(`Unable to remove the system-keyring session: ${errorMessage(error)}`)
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export const defaultSessionStore: SessionStore = {
  load: loadStoredSession,
  save: saveStoredSession,
  clear: clearStoredSession,
}
