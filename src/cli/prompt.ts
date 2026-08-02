import { createInterface } from 'node:readline'

export async function promptInput(prompt: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stderr })
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      rl.close()
      resolve(answer.trim())
    })
  })
}

/** Prompt for a password without echoing input. Requires an interactive terminal. */
export async function promptPassword(prompt: string): Promise<string> {
  if (!process.stdin.isTTY || !process.stdin.setRawMode) {
    throw new Error('Cannot securely prompt for a password without an interactive terminal.')
  }

  process.stderr.write(prompt)
  process.stdin.setRawMode(true)
  process.stdin.resume()
  process.stdin.setEncoding('utf8')

  return new Promise((resolve) => {
    let password = ''

    const cleanup = () => {
      process.stdin.setRawMode(false)
      process.stdin.pause()
      process.stdin.removeListener('data', onData)
    }

    const onData = (chunk: string) => {
      for (const char of chunk) {
        const code = char.charCodeAt(0)
        if (code === 3) {
          // Ctrl+C
          cleanup()
          process.stderr.write('\n')
          process.exit(130)
        }
        if (code === 13 || code === 10) {
          // Enter
          cleanup()
          process.stderr.write('\n')
          resolve(password)
          return
        }
        if (code === 8 || code === 127) {
          // Backspace
          password = password.slice(0, -1)
          continue
        }
        if (code >= 32) password += char
      }
    }

    process.stdin.on('data', onData)
  })
}
