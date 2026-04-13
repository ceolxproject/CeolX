export class AuthError extends Error {
  override readonly name = 'AuthError' as const;

  constructor(
    public readonly statusCode: number,
    message: string
  ) {
    super(message);
  }
}

export class NetworkError extends Error {
  override readonly name = 'NetworkError' as const;

  constructor(message = 'Network request failed') {
    super(message);
  }
}

export class ApiError extends Error {
  override readonly name = 'ApiError' as const;

  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string
  ) {
    super(message);
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}
