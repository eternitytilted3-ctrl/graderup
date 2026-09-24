/** Structured, user-safe error. Anything else thrown becomes a generic 500. */
export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export const Errors = {
  badRequest: (message = 'Некорректный запрос', details?: Record<string, unknown>) => new AppError(400, 'BAD_REQUEST', message, details),
  validation: (details: Record<string, unknown>) => new AppError(422, 'VALIDATION_ERROR', 'Проверьте введённые данные', details),
  unauthorized: (message = 'Требуется авторизация') => new AppError(401, 'UNAUTHORIZED', message),
  forbidden: (message = 'Недостаточно прав') => new AppError(403, 'FORBIDDEN', message),
  notFound: (message = 'Не найдено') => new AppError(404, 'NOT_FOUND', message),
  conflict: (message: string, code = 'CONFLICT') => new AppError(409, code, message),
  insufficientFunds: () => new AppError(402, 'INSUFFICIENT_FUNDS', 'Недостаточно средств на балансе'),
  rateLimited: (retryAfter: number) => new AppError(429, 'RATE_LIMITED', 'Слишком много запросов. Попробуйте позже.', { retryAfter }),
  banned: () => new AppError(403, 'ACCOUNT_BANNED', 'Аккаунт заблокирован'),
  restricted: (message = 'Сервис недоступен в вашем регионе') => new AppError(451, 'RESTRICTED', message),
  csrf: () => new AppError(403, 'CSRF', 'Недействительный токен безопасности. Обновите страницу.'),
  disabled: (message = 'Функция временно недоступна') => new AppError(503, 'FEATURE_DISABLED', message),
}
