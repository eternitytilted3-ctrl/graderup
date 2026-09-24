'use client'

/* eslint-disable @next/next/no-img-element */
import { Upload } from 'lucide-react'
import { useRef, useState } from 'react'
import { useToast } from '@/components/ui/Toast'
import { apiUpload, ApiError } from '@/lib/api'
import { Field } from './ui'

/** Image path/URL input with "upload file" (PNG/JPEG/WebP ≤ 3 MB, validated server-side) and preview. */
export function ImageField({ name, defaultValue, error, label = 'Изображение' }: { name: string; defaultValue?: string; error?: string; label?: string }) {
  const [value, setValue] = useState(defaultValue ?? '')
  const [loading, setLoading] = useState(false)
  const file = useRef<HTMLInputElement>(null)
  const toast = useToast()

  async function onFile(f: File | undefined) {
    if (!f) return
    setLoading(true)
    try {
      const fd = new FormData()
      fd.append('file', f)
      const r = await apiUpload<{ url: string }>('/api/admin/uploads', fd)
      setValue(r.url)
      toast.success('Картинка загружена')
    } catch (e) {
      toast.error('Не удалось загрузить', (e as ApiError).message)
    } finally {
      setLoading(false)
      if (file.current) file.current.value = ''
    }
  }

  return (
    <Field label={label} error={error} hint="Загрузите PNG/JPEG/WebP до 3 МБ или укажите /assets/… или https://…">
      <div className="flex gap-2">
        {value && <img src={value} alt="" className="size-10 shrink-0 rounded border border-border bg-bg-2 object-contain" />}
        <input name={name} className="input h-10" value={value} onChange={(e) => setValue(e.target.value)} required />
        <button type="button" onClick={() => file.current?.click()} disabled={loading} className="grid size-10 shrink-0 place-items-center rounded-md border border-border text-muted hover:border-accent/50 hover:text-accent disabled:opacity-50" aria-label="Загрузить картинку" title="Загрузить картинку">
          <Upload className="size-4" />
        </button>
        <input ref={file} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} data-testid={`${name}-upload`} />
      </div>
    </Field>
  )
}
