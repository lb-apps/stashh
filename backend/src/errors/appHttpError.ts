export class AppHttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly errorCode: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "AppHttpError";
  }

  toJSON(): Record<string, unknown> {
    const body: Record<string, unknown> = {
      error: this.message,
      error_code: this.errorCode,
    };
    if (this.details !== undefined) {
      body.details = this.details;
    }
    return body;
  }
}

export function isAppHttpError(value: unknown): value is AppHttpError {
  return value instanceof AppHttpError;
}
