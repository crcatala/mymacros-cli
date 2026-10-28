// Tests for src/cli-meta.ts, scripts/build-info.mjs, scripts/test-package.sh and scripts/release.mjs.
// Ported from the release standard's own template tests (node:test) to vitest.
import { execFileSync, spawnSync } from 'node:child_process'
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, describe, expect, test } from 'vitest'
import {
  buildInfo,
  checkForUpdate,
  compareVersions,
  detectInstall,
  formatVersion,
  gitCloneUrl,
  gitInstallUrl,
  packageMeta,
  updateSteps,
  versionDetails,
  versionLine,
} from '../src/cli-meta.js'

const repo = dirname(dirname(fileURLToPath(import.meta.url)))
const temp: string[] = []
const mkTemp = () => {
  const dir = mkdtempSync(join(tmpdir(), 'release-standard-'))
  temp.push(dir)
  return dir
}
afterAll(() => {
  for (const d of temp) rmSync(d, { recursive: true, force: true })
})

const gitEnv = {
  ...process.env,
  GIT_AUTHOR_NAME: 't',
  GIT_AUTHOR_EMAIL: 't@example.com',
  GIT_COMMITTER_NAME: 't',
  GIT_COMMITTER_EMAIL: 't@example.com',
  GIT_CONFIG_GLOBAL: '/dev/null',
}
const sh = (cwd: string, cmd: string, args: string[]) =>
  execFileSync(cmd, args, {
    cwd,
    env: gitEnv,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim()

const meta = (over: Partial<ReturnType<typeof packageMeta>> = {}) => ({
  root: '/x',
  name: '@scope/tool',
  version: '1.0.0',
  isPrivate: false,
  ...over,
})

describe('formatVersion', () => {
  test('version, short commit and date', () => {
    expect(
      formatVersion('mytool', { version: '1.4.2', commit: 'a1b2c3d4e5f6', date: '2026-10-27' }),
    ).toBe('mytool 1.4.2 (a1b2c3d 2026-10-27)')
  })
  test('dirty builds', () => {
    expect(
      formatVersion('mytool', {
        version: '1.4.2',
        commit: 'a1b2c3d4e5f6',
        date: '2026-10-27',
        dirty: true,
      }),
    ).toBe('mytool 1.4.2 (a1b2c3d-dirty 2026-10-27)')
  })
  test('no commit: no empty parentheses', () => {
    expect(formatVersion('mytool', { version: '1.4.2' })).toBe('mytool 1.4.2')
  })
})

describe('detectInstall', () => {
  test('checkout wins', () => expect(detectInstall('/Users/u/src/tool', true)).toBe('checkout'))
  test('npx', () =>
    expect(detectInstall('/Users/u/.npm/_npx/abc/node_modules/tool', false)).toBe('npx'))
  test('mise', () =>
    expect(
      detectInstall(
        '/Users/u/.local/share/mise/installs/npm-tool/1.0.0/lib/node_modules/tool',
        false,
      ),
    ).toBe('mise'))
  test('bun', () =>
    expect(detectInstall('/Users/u/.bun/install/global/node_modules/tool', false)).toBe('bun'))
  test('pnpm', () =>
    expect(detectInstall('/Users/u/.local/share/pnpm/global/5/node_modules/tool', false)).toBe(
      'pnpm',
    ))
  test('npm global', () =>
    expect(detectInstall('/usr/lib/node_modules/tool', false, '/usr/lib/node_modules')).toBe('npm'))
  test('project dependency is unknown', () =>
    expect(detectInstall('/proj/node_modules/tool', false, '/usr/lib/node_modules')).toBe(
      'unknown',
    ))
})

describe('updateSteps', () => {
  test('registry installs use @latest', () => {
    expect(updateSteps('npm', meta())).toEqual([
      { cmd: 'npm', args: ['install', '-g', '@scope/tool@latest'] },
    ])
    expect(updateSteps('mise', meta())).toEqual([
      { cmd: 'mise', args: ['upgrade', '--bump', 'npm:@scope/tool'] },
    ])
  })
  test('private packages reinstall from git, never from the registry', () => {
    const priv = meta({ isPrivate: true, repositoryUrl: 'github:o/r' })
    const url = 'git+https://github.com/o/r.git'
    expect(updateSteps('npm', priv)).toEqual([{ cmd: 'npm', args: ['install', '-g', url] }])
    expect(updateSteps('pnpm', priv)).toEqual([{ cmd: 'pnpm', args: ['add', '-g', url] }])
    expect(updateSteps('bun', priv)).toEqual([{ cmd: 'bun', args: ['add', '-g', url] }])
    expect(updateSteps('mise', priv)).toBeNull()
    expect(updateSteps('npm', meta({ isPrivate: true }))).toBeNull()
  })
  test('checkout pulls, installs and builds with its package manager', () => {
    expect(
      updateSteps('checkout', meta(), 'pnpm').map((s) => [s.cmd, ...s.args].join(' ')),
    ).toEqual(['git pull --ff-only origin main', 'pnpm install', 'pnpm run build'])
  })
  test('unknown and npx have no steps', () => {
    expect(updateSteps('unknown', meta())).toBeNull()
    expect(updateSteps('npx', meta())).toBeNull()
  })
})

test('repository URLs normalize once for git and for installers', () => {
  for (const [input, clone] of [
    ['github:o/r', 'https://github.com/o/r.git'],
    ['o/r', 'https://github.com/o/r.git'],
    ['o/r.git', 'https://github.com/o/r.git'],
    ['git@github.com:o/r.git', 'ssh://git@github.com/o/r.git'],
    ['https://github.com/o/r.git', 'https://github.com/o/r.git'],
    ['git+https://github.com/o/r.git', 'https://github.com/o/r.git'],
    ['git+ssh://git@github.com/o/r.git', 'ssh://git@github.com/o/r.git'],
  ]) {
    expect(gitCloneUrl(input), input).toBe(clone)
    expect(gitInstallUrl(input), input).toBe(`git+${clone}`)
  }
})

test('compareVersions', () => {
  expect(compareVersions('1.2.3', '1.10.0')).toBeLessThan(0)
  expect(compareVersions('2.0.0', '1.99.99')).toBeGreaterThan(0)
  expect(compareVersions('v1.0.0', '1.0.0')).toBe(0)
  expect(compareVersions('1.0.0-alpha', '1.0.0')).toBeLessThan(0)
})

describe('packageMeta and buildInfo', () => {
  test('walks up to package.json and prefers the stamp', () => {
    const root = mkTemp()
    mkdirSync(join(root, 'dist', 'cli'), { recursive: true })
    writeFileSync(
      join(root, 'package.json'),
      JSON.stringify({
        name: 't',
        version: '2.0.0',
        private: true,
        repository: { url: 'github:o/r' },
      }),
    )
    writeFileSync(
      join(root, 'dist', 'build-info.json'),
      JSON.stringify({
        version: '2.0.0',
        commit: 'f'.repeat(40),
        date: '2026-01-02',
        dirty: false,
      }),
    )
    const m = packageMeta(join(root, 'dist', 'cli'))
    expect(m.name).toBe('t')
    expect(m.isPrivate).toBe(true)
    expect(m.repositoryUrl).toBe('github:o/r')
    expect(formatVersion('t', buildInfo(m))).toBe('t 2.0.0 (fffffff 2026-01-02)')
  })
  test('falls back to git in a checkout without a build', () => {
    const root = mkTemp()
    writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 't', version: '0.1.0' }))
    sh(root, 'git', ['init', '-q', '-b', 'main'])
    sh(root, 'git', ['add', '-A'])
    sh(root, 'git', ['commit', '-q', '-m', 'init'])
    const info = buildInfo(packageMeta(root))
    expect(info.commit).toBe(sh(root, 'git', ['rev-parse', 'HEAD']))
    expect(info.dirty).toBe(false)
  })
  test('in a checkout, dist/ reports the stamp and src/ reads git', () => {
    const root = mkTemp()
    mkdirSync(join(root, 'src'))
    mkdirSync(join(root, 'dist'))
    writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 't', version: '0.1.0' }))
    writeFileSync(join(root, '.gitignore'), 'dist/\n')
    writeFileSync(
      join(root, 'dist', 'build-info.json'),
      JSON.stringify({
        version: '0.1.0',
        commit: 'e'.repeat(40),
        date: '2026-01-01',
        dirty: false,
      }),
    )
    sh(root, 'git', ['init', '-q', '-b', 'main'])
    sh(root, 'git', ['add', '-A'])
    sh(root, 'git', ['commit', '-q', '-m', 'init'])
    writeFileSync(join(root, 'src', 'edited.ts'), 'x')
    const m = packageMeta(root)
    expect(buildInfo(m, join(root, 'dist')).commit).toBe('e'.repeat(40))
    const fromSource = buildInfo(m, join(root, 'src'))
    expect(fromSource.commit).toBe(sh(root, 'git', ['rev-parse', 'HEAD']))
    expect(fromSource.dirty).toBe(true)
  })
  test('version only outside git', () => {
    const root = mkTemp()
    writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 't', version: '0.1.0' }))
    expect(buildInfo(packageMeta(root))).toEqual({ version: '0.1.0' })
  })
})

describe('versionLine and versionDetails in this checkout', () => {
  test('versionLine names the tool, version, commit and date', () => {
    expect(versionLine('mymacros')).toMatch(
      /^mymacros \d+\.\d+\.\d+ \([0-9a-f]{7}(-dirty)? \d{4}-\d{2}-\d{2}\)$/,
    )
  })
  test('versionDetails reports the checkout and its path', () => {
    const details = versionDetails()
    expect(details.install).toBe('checkout')
    expect(details.path).toBe(packageMeta().root)
    expect(details.commit).toBe(sh(packageMeta().root, 'git', ['rev-parse', 'HEAD']))
  })
})

describe('checkForUpdate in a checkout', () => {
  // A clone of a one-commit origin, with dist/ stamped at `stampAt` (a commit id or "head").
  const clone = (stampAt: 'head' | string, dirty = false) => {
    const origin = mkTemp()
    writeFileSync(join(origin, 'package.json'), JSON.stringify({ name: 't', version: '0.1.0' }))
    writeFileSync(join(origin, '.gitignore'), 'dist/\n')
    sh(origin, 'git', ['init', '-q', '-b', 'main'])
    sh(origin, 'git', ['add', '-A'])
    sh(origin, 'git', ['commit', '-q', '-m', 'init'])
    const root = join(mkTemp(), 'clone')
    sh(origin, 'git', ['clone', '-q', origin, root])
    const head = sh(root, 'git', ['rev-parse', 'HEAD'])
    mkdirSync(join(root, 'dist'))
    const commit = stampAt === 'head' ? head : stampAt
    writeFileSync(
      join(root, 'dist', 'build-info.json'),
      JSON.stringify({ version: '0.1.0', commit, date: '2026-01-01', dirty }),
    )
    const m = packageMeta(root)
    return {
      m,
      root,
      head,
      status: () => checkForUpdate('checkout', m, buildInfo(m, join(root, 'dist'))),
    }
  }
  test('current build: up to date', () => {
    const { status } = clone('head')
    expect(status().available).toBe(false)
  })
  test('build older than the checkout (pull done, build failed): update available', () => {
    const { status, head } = clone('a'.repeat(40))
    const s = status()
    expect(s.available).toBe(true)
    expect(s.current).toBe('aaaaaaa')
    expect(s.latest).toBe(head.slice(0, 7))
    expect(s.note ?? '').toMatch(/build is older/)
  })
  test('dirty build in a checkout that is clean now (edits discarded): update available', () => {
    const { status, head } = clone('head', true)
    const s = status()
    expect(s.available).toBe(true)
    expect(s.current).toBe(`${head.slice(0, 7)}-dirty`)
    expect(s.note ?? '').toMatch(/uncommitted edits/)
  })
  test('dirty build with the edits still in the checkout: up to date', () => {
    const { status, root } = clone('head', true)
    writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 't', version: '0.1.0', x: 1 }))
    expect(status().available).toBe(false)
  })
})

// End to end: a tiny CLI using the real cli-meta (types stripped to JS), packed and smoke-tested by
// the canonical test-package.sh, which runs prepack → build-info.mjs and checks the --version line.
test('test-package.sh accepts a stamped build and rejects a missing stamp', () => {
  const root = mkTemp()
  mkdirSync(join(root, 'scripts'))
  mkdirSync(join(root, 'lib'))
  copyFileSync(join(repo, 'scripts', 'build-info.mjs'), join(root, 'scripts', 'build-info.mjs'))
  copyFileSync(join(repo, 'scripts', 'test-package.sh'), join(root, 'scripts', 'test-package.sh'))
  const source = readFileSync(join(repo, 'src', 'cli-meta.ts'), 'utf8')
  writeFileSync(join(root, 'lib', 'cli-meta.js'), stripTypeScriptTypes(source))
  writeFileSync(
    join(root, 'lib', 'cli.js'),
    `#!/usr/bin/env node
import { versionLine } from "./cli-meta.js";
if (process.argv.includes("--version")) console.log(versionLine("fixture"));
else console.log("usage: fixture");
`,
  )
  const pkg = {
    name: 'release-standard-fixture',
    version: '1.2.3',
    type: 'module',
    bin: { fixture: 'lib/cli.js', fx: 'lib/cli.js' },
    files: ['lib', 'dist'],
    scripts: { build: 'node scripts/build-info.mjs', prepack: 'npm run build' },
  }
  writeFileSync(join(root, 'package.json'), JSON.stringify(pkg, null, 2))
  writeFileSync(join(root, '.gitignore'), 'dist/\n')
  sh(root, 'git', ['init', '-q', '-b', 'main'])
  sh(root, 'git', ['add', '-A'])
  sh(root, 'git', ['commit', '-q', '-m', 'init'])

  expect(sh(root, 'bash', ['scripts/test-package.sh'])).toMatch(/Package smoke test passed/)

  writeFileSync(join(root, 'package.json'), JSON.stringify({ ...pkg, files: ['lib'] }, null, 2))
  expect(() => sh(root, 'bash', ['scripts/test-package.sh'])).toThrow(/expected '<name> X\.Y\.Z/)
}, 60_000)

// release.mjs with stub `npm` and `release-it` executables: the preflight gates the publish, and the
// publish happens only after release-it has tagged the release commit.
describe('release.mjs', () => {
  const script = join(repo, 'scripts', 'release.mjs')
  const setup = (pkg: Record<string, unknown> = { name: 't', version: '1.0.0' }) => {
    const root = mkTemp()
    const bin = join(root, 'stub-bin')
    const log = join(root, 'calls.log')
    mkdirSync(bin)
    mkdirSync(join(root, 'node_modules', '.bin'), { recursive: true })
    // npm: logged in, version not on the registry yet, publish recorded.
    writeFileSync(
      join(bin, 'npm'),
      `#!/usr/bin/env bash
echo "npm $*" >> "${log}"
case "$1" in
  whoami) echo tester ;;
  view) echo "npm error code E404" >&2; exit 1 ;;
esac
`,
    )
    // release-it: bump to 1.0.1, commit and tag, as the real one does (dry runs change nothing).
    writeFileSync(
      join(root, 'node_modules', '.bin', 'release-it'),
      `#!/usr/bin/env bash
echo "release-it $*" >> "${log}"
for a in "$@"; do [[ "$a" == --dry-run ]] && exit 0; done
node -e 'const f="package.json",p=JSON.parse(require("fs").readFileSync(f));p.version="1.0.1";require("fs").writeFileSync(f,JSON.stringify(p))'
git commit -qam "chore: release v1.0.1" && git tag -a v1.0.1 -m "Release 1.0.1"
`,
    )
    chmodSync(join(bin, 'npm'), 0o755)
    chmodSync(join(root, 'node_modules', '.bin', 'release-it'), 0o755)
    writeFileSync(join(root, 'package.json'), JSON.stringify(pkg))
    writeFileSync(join(root, '.gitignore'), 'node_modules/\nstub-bin/\ncalls.log\n')
    sh(root, 'git', ['init', '-q', '-b', 'main'])
    sh(root, 'git', ['add', '-A'])
    sh(root, 'git', ['commit', '-q', '-m', 'init'])
    const runIt = (...args: string[]) =>
      spawnSync(process.execPath, [script, ...args], {
        cwd: root,
        encoding: 'utf8',
        env: { ...gitEnv, PATH: `${bin}:${process.env.PATH}` },
      })
    const calls = () => (existsSync(log) ? readFileSync(log, 'utf8') : '')
    return { root, runIt, calls }
  }

  test('prints usage without a command', () => {
    const { runIt } = setup()
    const r = runIt()
    expect(r.status).toBe(1)
    expect(r.stderr).toMatch(/usage: node scripts\/release\.mjs/)
  })

  test('publish refuses an untagged HEAD', () => {
    const { runIt, calls } = setup()
    const r = runIt('publish')
    expect(r.status).toBe(1)
    expect(r.stderr).toMatch(/HEAD is not tagged v1\.0\.0/)
    expect(calls()).not.toMatch(/npm publish/)
  })

  test('a dry run never publishes', () => {
    const { runIt, calls } = setup()
    expect(runIt('release', '--dry-run').status).toBe(0)
    expect(calls()).toMatch(/release-it --dry-run/)
    expect(calls()).not.toMatch(/npm publish/)
  })

  test('release publishes after release-it tags, without --access', () => {
    const { runIt, calls } = setup()
    const r = runIt('release', 'patch')
    expect(r.status).toBe(0)
    const log = calls()
    expect(log.indexOf('release-it patch')).toBeLessThan(log.indexOf('npm publish'))
    expect(log).toMatch(/^npm publish$/m)
  })

  test('refuses to release when HEAD is already the release', () => {
    const { root, runIt, calls } = setup()
    sh(root, 'git', ['tag', '-a', 'v1.0.0', '-m', 'Release 1.0.0'])
    const r = runIt('release')
    expect(r.status).toBe(1)
    expect(r.stderr).toMatch(/already the v1\.0\.0 release/)
    expect(calls()).not.toMatch(/release-it/)
  })

  test('a private package is released but never published', () => {
    const { runIt, calls } = setup({ name: 't', version: '1.0.0', private: true })
    expect(runIt('release', 'patch').status).toBe(0)
    expect(calls()).not.toMatch(/npm (publish|whoami)/)
  })
})
