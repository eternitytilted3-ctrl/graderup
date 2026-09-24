'use client'

/** Browser API client: adds CSRF + Idempotency-Key headers and normalizes errors. */
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public fields?: Record<string, string>,
  ) {
    super(message)
  }
}

function readCookie(name: string) {
  if (typeof document === 'undefined') return ''
  const m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'))
  return m ? decodeURIComponent(m[1]) : ''
}

export function newIdempotencyKey() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export async function api<T = unknown>(
  path: string,
  opts: { method?: string; body?: unknown; idempotencyKey?: string; signal?: AbortSignal } = {},
): Promise<T> {
  const method = opts.method ?? (opts.body !== undefined ? 'POST' : 'GET')
  const headers: Record<string, string> = { accept: 'application/json' }
  if (opts.body !== undefined) headers['content-type'] = 'application/json'
  if (method !== 'GET') {
    headers['x-csrf-token'] = readCookie('gu_csrf')
    headers['idempotency-key'] = opts.idempotencyKey ?? newIdempotencyKey()
  }
  let res: Response
  try {
    res = await fetch(path, {
      method,
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      credentials: 'same-origin',
      signal: opts.signal,
    })
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err
    throw new ApiError(0, 'NETWORK', 'Нет соединения с сервером. Проверьте интернет.')
  }
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    const e = data?.error ?? {}
    throw new ApiError(res.status, e.code ?? 'UNKNOWN', e.message ?? 'Что-то пошло не так', e.fields)
  }
  return data as T
}

export function qs(params: Record<string, string | number | undefined | null>) {
  const s = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') s.set(k, String(v))
  const str = s.toString()
  return str ? `?${str}` : ''
}

/** multipart upload (admin images). Same CSRF/idempotency headers as `api`. */
export async function apiUpload<T = unknown>(path: string, form: FormData): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    body: form,
    credentials: 'same-origin',
    headers: { accept: 'application/json', 'x-csrf-token': readCookie('gu_csrf'), 'idempotency-key': newIdempotencyKey() },
  }).catch(() => {
    throw new ApiError(0, 'NETWORK', 'Нет соединения с сервером.')
  })
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    const e = data?.error ?? {}
    throw new ApiError(res.status, e.code ?? 'UNKNOWN', e.fields?.file ?? e.message ?? 'Ошибка загрузки', e.fields)
  }
  return data as T
}
