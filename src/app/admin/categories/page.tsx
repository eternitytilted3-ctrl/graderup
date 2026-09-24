'use client'

import { Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { AdminTitle, DataTable, Field } from '@/components/admin/ui'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { Modal } from '@/components/ui/Modal'
import { ErrorState, LoadingState } from '@/components/ui/States'
import { useToast } from '@/components/ui/Toast'
import { api, ApiError } from '@/lib/api'
import { useFetch } from '@/lib/useFetch'

interface Cat {
  id: string
  name: string
  slug: string
  sortOrder: number
  isActive: boolean
  caseCount: number
}

export default function AdminCategories() {
  const toast = useToast()
  const { data, error, reload } = useFetch<{ items: Cat[] }>('/api/admin/categories')
  const [edit, setEdit] = useState<Cat | 'new' | null>(null)
  const [del, setDel] = useState<Cat | null>(null)
  const [errs, setErrs] = useState<Record<string, string>>({})
  const cur = edit && edit !== 'new' ? edit : null

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    setErrs({})
    try {
      await api(cur ? `/api/admin/categories/${cur.id}` : '/api/admin/categories', {
        method: cur ? 'PUT' : 'POST',
        body: { name: fd.get('name'), slug: fd.get('slug'), sortOrder: Number(fd.get('sortOrder') || 0), isActive: fd.get('isActive') === 'on' },
      })
      toast.success('Категория сохранена')
      setEdit(null)
      reload()
    } catch (err) {
      const ae = err as ApiError
      setErrs(ae.fields ?? {})
      toast.error('Ошибка', ae.message)
    }
  }

  async function remove() {
    if (!del) return
    try {
      await api(`/api/admin/categories/${del.id}`, { method: 'DELETE' })
      toast.success('Категория удалена', 'Кейсы остались без категории')
      reload()
    } catch (err) {
      toast.error('Ошибка', (err as ApiError).message)
    } finally {
      setDel(null)
    }
  }

  if (error) return <ErrorState description={error.message} onRetry={reload} />
  if (!data) return <LoadingState />
  return (
    <>
      <AdminTitle title="Категории кейсов" description="Секции каталога /cases. Порядок — по полю «Порядок». Кейс привязывается к категории в его редакторе." actions={<Button onClick={() => { setErrs({}); setEdit('new') }}>Создать</Button>} />
      <DataTable
        rows={data.items}
        onRowClick={(r) => { setErrs({}); setEdit(r) }}
        columns={[
          { key: 'o', label: 'Порядок', render: (r) => <span className="tnum">{r.sortOrder}</span> },
          { key: 'n', label: 'Название', render: (r) => <span className="font-medium">{r.name}</span> },
          { key: 's', label: 'Slug', render: (r) => <span className="text-muted">{r.slug}</span> },
          { key: 'c', label: 'Кейсов', render: (r) => r.caseCount },
          { key: 'a', label: 'Статус', render: (r) => (r.isActive ? <Badge tone="success">active</Badge> : <Badge>off</Badge>) },
          {
            key: 'x',
            label: '',
            render: (r) => (
              <button onClick={(e) => { e.stopPropagation(); setDel(r) }} className="rounded p-1.5 text-subtle hover:bg-danger/10 hover:text-danger" aria-label={`Удалить ${r.name}`}>
                <Trash2 className="size-4" />
              </button>
            ),
          },
        ]}
      />
      <Modal open={Boolean(edit)} onClose={() => setEdit(null)} title={cur ? `Категория «${cur.name}»` : 'Новая категория'}>
        <form key={cur?.id ?? 'new'} onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
          <Field label="Название" error={errs.name}>
            <input name="name" className="input h-10" defaultValue={cur?.name} required />
          </Field>
          <Field label="Slug" error={errs.slug}>
            <input name="slug" className="input h-10" defaultValue={cur?.slug} required pattern="[a-z0-9-]+" />
          </Field>
          <Field label="Порядок" error={errs.sortOrder}>
            <input name="sortOrder" type="number" min="0" className="input h-10" defaultValue={cur?.sortOrder ?? 0} />
          </Field>
          <label className="flex items-center gap-2 self-end text-sm text-muted">
            <input type="checkbox" name="isActive" defaultChecked={cur?.isActive ?? true} className="size-4 accent-[#7C5CFF]" /> Показывать в каталоге
          </label>
          <div className="flex justify-end sm:col-span-2">
            <Button type="submit">Сохранить</Button>
          </div>
        </form>
      </Modal>
      <ConfirmModal open={Boolean(del)} title="Удалить категорию?" variant="danger" confirmLabel="Удалить" onClose={() => setDel(null)} onConfirm={remove}>
        Кейсы категории «{del?.name}» не удаляются — они попадут в секцию «Другие».
      </ConfirmModal>
    </>
  )
}
