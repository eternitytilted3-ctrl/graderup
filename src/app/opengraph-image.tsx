import { ImageResponse } from 'next/og'

export const alt = 'GraderUP — кейсы, апгрейд и инвентарь'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: 80, background: 'linear-gradient(135deg,#080B12 0%,#111722 60%,#1b1540 100%)', color: '#F5F7FA' }}>
        <div style={{ display: 'flex', fontSize: 96, fontWeight: 800, letterSpacing: -2 }}>
          Grader<span style={{ color: '#00D4FF' }}>UP</span>
        </div>
        <div style={{ fontSize: 40, marginTop: 20, color: '#8993A4' }}>Cases · Upgrade · Inventory</div>
        <div style={{ display: 'flex', marginTop: 48, width: 220, height: 8, background: 'linear-gradient(90deg,#7C5CFF,#00D4FF)', borderRadius: 4 }} />
      </div>
    ),
    size,
  )
}
