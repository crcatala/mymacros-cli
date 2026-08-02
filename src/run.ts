import { CommanderError } from 'commander'
import { createContext } from './cli/context.js'
import { setOutputStream } from './cli/output.js'
import { createProgram } from './cli/program.js'

export type RunEnv = {
  env: Record<string, string | undefined>
  stdout: NodeJS.WritableStream
  stderr: NodeJS.WritableStream
}

export async function runCli(argv: string[], { env, stdout, stderr }: RunEnv): Promise<void> {
  setOutputStream(stdout, stderr)

  const ctx = createContext(argv, env)
  const program = createProgram(ctx)

  program.configureOutput({
    writeOut: (str) => stdout.write(str),
    writeErr: (str) => stderr.write(str),
  })

  program.exitOverride()

  try {
    await program.parseAsync(argv, { from: 'user' })
  } catch (error) {
    if (error instanceof CommanderError) {
      const passthrough = ['commander.helpDisplayed', 'commander.version', 'commander.help']
      if (passthrough.includes(error.code)) return
    }
    throw error
  }
}
