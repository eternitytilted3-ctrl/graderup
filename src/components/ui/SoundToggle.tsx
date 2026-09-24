'use client'

import { Volume2, VolumeX } from 'lucide-react'
import { useEffect, useState } from 'react'
import { isMuted, onMutedChange, setMuted, sfx } from '@/lib/sound'

export function SoundToggle({ className = '' }: { className?: string }) {
  const [muted, set] = useState(false)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    set(isMuted())
    const off = onMutedChange(set)
    return () => {
      off()
    }
  }, [])
  return (
    <button
      onClick={() => {
        setMuted(!muted)
        if (muted) setTimeout(() => sfx.click(), 0)
      }}
      className={`grid size-10 place-items-center rounded-md border border-border text-muted transition hover:border-border-strong hover:text-text ${className}`}
      aria-label={muted ? 'Включить звук' : 'Выключить звук'}
      aria-pressed={!muted}
      title={muted ? 'Звук выключен' : 'Звук включён'}
    >
      {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
    </button>
  )
}
