export class CliError extends Error {
  constructor(
    message: string,
    public code: string,
    public exitCode = 1,
  ) {
    super(message)
    this.name = 'CliError'
  }

  toJSON(): Record<string, unknown> {
    return { error: true, code: this.code, message: this.message }
  }
}

export class UsageError extends CliError {
  constructor(message: string) {
    super(message, 'USAGE_ERROR', 2)
    this.name = 'UsageError'
  }
}

export class AuthError extends CliError {
  constructor(message: string) {
    super(message, 'AUTH_ERROR', 1)
    this.name = 'AuthError'
  }
}

export class ApiError extends CliError {
  constructor(
    message: string,
    public apiCode?: number,
  ) {
    super(message, 'API_ERROR', 1)
    this.name = 'ApiError'
  }

  toJSON(): Record<string, unknown> {
    return { error: true, code: this.code, apiCode: this.apiCode, message: this.message }
  }
}

export function isCliError(error: unknown): error is CliError {
  return error instanceof CliError
}
