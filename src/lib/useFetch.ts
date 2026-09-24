'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { api, ApiError } from './api'

/** Minimal data hook: loading / error / reload, aborts stale requests. */
export function useFetch<T>(url: string | null) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<ApiError | null>(null)
  const [loading, setLoading] = useState(Boolean(url))
  const [nonce, setNonce] = useState(0)
  const ctrl = useRef<AbortController | null>(null)

  useEffect(() => {
    if (!url) return
    ctrl.current?.abort()
    const c = new AbortController()
    ctrl.current = c
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    setError(null)
    api<T>(url, { signal: c.signal })
      .then((d) => !c.signal.aborted && setData(d))
      .catch((e) => {
        if ((e as Error).name !== 'AbortError') setError(e as ApiError)
      })
      .finally(() => !c.signal.aborted && setLoading(false))
    return () => c.abort()
  }, [url, nonce])

  const reload = useCallback(() => setNonce((n) => n + 1), [])
  return { data, error, loading, reload, setData }
}
