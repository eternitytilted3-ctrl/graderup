'use client'

import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { api, ApiError } from '@/lib/api'
import { useFetch } from '@/lib/useFetch'
import { ImageField } from './ImageField'
import { Field } from './ui'

export interface CaseRecord {
  id: string
  name: string
  slug: string
  description: string
  image: string
  price: string
  status: 'active' | 'disabled'
  sortOrder: number
  isFeatured: boolean
  categoryId?: string | null
}

export function CaseForm({ initial, onSaved }: { initial?: CaseRecord; onSaved: (c: CaseRecord) => void }) {
  const toast = useToast()
  const [errs, setErrs] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const cats = useFetch<{ items: { id: string; name: string }[] }>('/api/admin/categories')
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    setLoading(true)
    setErrs({})
    try {
      const body = {
        name: fd.get('name'),
        slug: fd.get('slug'),
        description: fd.get('description'),
        image: fd.get('image'),
        price: Number(fd.get('price')),
        status: fd.get('status'),
        sortOrder: Number(fd.get('sortOrder') || 0),
        isFeatured: fd.get('isFeatured') === 'on',
        categoryId: String(fd.get('categoryId') || '') || null,
      }
      const r = await api<CaseRecord>(initial ? `/api/admin/cases/${initial.id}` : '/api/admin/cases', { method: initial ? 'PUT' : 'POST', body })
      toast.success('Кейс сохранён')
      onSaved(r)
    } catch (err) {
      const ae = err as ApiError
      setErrs(ae.fields ?? {})
      toast.error('Ошибка сохранения', ae.message)
    } finally {
      setLoading(false)
    }
  }
  return (
    <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
      <Field label="Название" error={errs.name}>
        <input name="name" className="input h-10" defaultValue={initial?.name} required />
      </Field>
      <Field label="Slug (URL)" error={errs.slug}>
        <input name="slug" className="input h-10" defaultValue={initial?.slug} required pattern="[a-z0-9-]+" />
      </Field>
      <Field label="Цена, C" error={errs.price}>
        <input name="price" type="number" step="0.01" min="0.01" className="input h-10 tnum" defaultValue={initial?.price} required />
      </Field>
      <Field label="Статус" error={errs.status}>
        <select name="status" className="input h-10" defaultValue={initial?.status ?? 'active'}>
          <option value="active">active</option>
          <option value="disabled">disabled</option>
        </select>
      </Field>
      <ImageField name="image" defaultValue={initial?.image ?? '/assets/cases/magnum.svg'} error={errs.image} />
      <Field label="Категория" error={errs.categoryId}>
        <select name="categoryId" className="input h-10" defaultValue={initial?.categoryId ?? ''} key={cats.data ? 'loaded' : 'loading'}>
          <option value="">— без категории —</option>
          {cats.data?.items.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Порядок сортировки" error={errs.sortOrder}>
        <input name="sortOrder" type="number" className="input h-10" defaultValue={initial?.sortOrder ?? 0} />
      </Field>
      <div className="sm:col-span-2">
        <Field label="Описание" error={errs.description}>
          <textarea name="description" className="input h-20 py-2" defaultValue={initial?.description} maxLength={2000} />
        </Field>
      </div>
      <label className="flex items-center gap-2 text-sm text-muted">
        <input type="checkbox" name="isFeatured" defaultChecked={initial?.isFeatured} className="size-4 accent-[#7C5CFF]" /> Популярный (HOT)
      </label>
      <div className="flex justify-end sm:col-span-2">
        <Button type="submit" loading={loading}>
          Сохранить
        </Button>
      </div>
    </form>
  )
}
