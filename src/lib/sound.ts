'use client'

/**
 * Procedural UI sounds (Web Audio API) — no audio files, nothing to license.
 * Muted state persists in localStorage ('gu_muted').
 */
let ctx: AudioContext | null = null
let master: GainNode | null = null
const listeners = new Set<(muted: boolean) => void>()

function readMuted() {
  try {
    return localStorage.getItem('gu_muted') === '1'
  } catch {
    return false
  }
}
let muted = typeof window !== 'undefined' ? readMuted() : false

export function isMuted() {
  return muted
}
export function setMuted(v: boolean) {
  muted = v
  try {
    localStorage.setItem('gu_muted', v ? '1' : '0')
  } catch {}
  listeners.forEach((l) => l(v))
}
export function onMutedChange(fn: (m: boolean) => void) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

function audio() {
  if (muted || typeof window === 'undefined') return null
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return null
    ctx = new AC()
    master = ctx.createGain()
    master.gain.value = 0.35
    master.connect(ctx.destination)
  }
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

function tone(freq: number, dur: number, opts: { type?: OscillatorType; gain?: number; delay?: number; slideTo?: number } = {}) {
  const a = audio()
  if (!a || !master) return
  const t = a.currentTime + (opts.delay ?? 0)
  const osc = a.createOscillator()
  const g = a.createGain()
  osc.type = opts.type ?? 'sine'
  osc.frequency.setValueAtTime(freq, t)
  if (opts.slideTo) osc.frequency.exponentialRampToValueAtTime(opts.slideTo, t + dur)
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(opts.gain ?? 0.3, t + 0.005)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  osc.connect(g).connect(master)
  osc.start(t)
  osc.stop(t + dur + 0.02)
}

function noise(dur: number, gain = 0.15, delay = 0) {
  const a = audio()
  if (!a || !master) return
  const buf = a.createBuffer(1, Math.ceil(a.sampleRate * dur), a.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length)
  const src = a.createBufferSource()
  const g = a.createGain()
  const f = a.createBiquadFilter()
  f.type = 'bandpass'
  f.frequency.value = 1800
  g.gain.value = gain
  src.buffer = buf
  src.connect(f).connect(g).connect(master)
  src.start(a.currentTime + delay)
}

const RARITY_NOTES: Record<string, number[]> = {
  common: [440, 554],
  uncommon: [494, 622],
  rare: [523, 659, 784],
  epic: [587, 740, 880],
  legendary: [659, 831, 988, 1319],
  mythic: [698, 880, 1047, 1397, 1760],
}

export const sfx = {
  click: () => tone(900, 0.04, { type: 'triangle', gain: 0.12 }),
  /** Roulette/dial tick — pitch rises slightly with speed. */
  tick: (speed = 1) => {
    tone(1400 + Math.min(600, speed * 200), 0.03, { type: 'square', gain: 0.06 })
  },
  caseOpen: () => {
    noise(0.25, 0.2)
    tone(180, 0.25, { type: 'sawtooth', gain: 0.08, slideTo: 90 })
  },
  drop: (rarity: string) => {
    const notes = RARITY_NOTES[rarity] ?? RARITY_NOTES.common
    notes.forEach((f, i) => tone(f, 0.35, { type: 'triangle', gain: 0.22, delay: i * 0.08 }))
    if (rarity === 'legendary' || rarity === 'mythic') noise(0.6, 0.08, 0.1)
  },
  upgradeStart: () => tone(200, 0.6, { type: 'sawtooth', gain: 0.07, slideTo: 800 }),
  success: () => {
    ;[523, 659, 784, 1047].forEach((f, i) => tone(f, 0.4, { type: 'triangle', gain: 0.25, delay: i * 0.09 }))
    noise(0.4, 0.06, 0.2)
  },
  fail: () => {
    tone(330, 0.35, { type: 'sawtooth', gain: 0.12, slideTo: 110 })
    tone(220, 0.5, { type: 'square', gain: 0.06, delay: 0.12, slideTo: 70 })
  },
  /** Crate unlock: two latch clacks, a rising hum and a burst. */
  crateUnlock: () => {
    noise(0.05, 0.35)
    tone(420, 0.06, { type: 'square', gain: 0.1 })
    noise(0.05, 0.35, 0.16)
    tone(380, 0.06, { type: 'square', gain: 0.1, delay: 0.16 })
    tone(90, 0.7, { type: 'sawtooth', gain: 0.08, delay: 0.25, slideTo: 420 })
    noise(0.45, 0.22, 0.85)
    tone(880, 0.3, { type: 'triangle', gain: 0.14, delay: 0.9, slideTo: 1320 })
  },
  /** Bonus zone revealed on the upgrade dial. */
  bonus: () => {
    ;[988, 1319, 1760].forEach((f, i) => tone(f, 0.18, { type: 'triangle', gain: 0.16, delay: i * 0.06 }))
  },
  coin: () => {
    tone(1318, 0.08, { type: 'square', gain: 0.1 })
    tone(1760, 0.18, { type: 'square', gain: 0.1, delay: 0.07 })
  },
}
