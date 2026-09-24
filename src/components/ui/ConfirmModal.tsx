'use client'

import type { ReactNode } from 'react'
import { Button } from './Button'
import { Modal } from './Modal'

export function ConfirmModal({
  open,
  title,
  children,
  confirmLabel = 'Подтвердить',
  cancelLabel = 'Отмена',
  variant = 'primary',
  loading,
  onConfirm,
  onClose,
}: {
  open: boolean
  title: ReactNode
  children?: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'primary' | 'danger'
  loading?: boolean
  onConfirm: () => void
  onClose: () => void
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button variant={variant} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="text-sm leading-relaxed text-muted">{children}</div>
    </Modal>
  )
}
