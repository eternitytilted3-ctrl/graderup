import { describe, expect, it } from 'vitest'
import { sniffImage, UPLOAD_NAME_RE } from '@/server/services/uploads'

describe('upload validation', () => {
  it('detects real image types by magic bytes', () => {
    expect(sniffImage(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]))).toBe('png')
    expect(sniffImage(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0]))).toBe('jpg')
    expect(sniffImage(Buffer.from('RIFF\0\0\0\0WEBPVP8 '))).toBe('webp')
  })
  it('rejects SVG / HTML / renamed files', () => {
    expect(sniffImage(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'))).toBeNull()
    expect(sniffImage(Buffer.from('<!doctype html><html>'))).toBeNull()
    expect(sniffImage(Buffer.from('GIF89a......'))).toBeNull()
  })
  it('only serves generated names (no path traversal)', () => {
    expect(UPLOAD_NAME_RE.test('0123456789abcdef0123456789abcdef.png')).toBe(true)
    expect(UPLOAD_NAME_RE.test('../../etc/passwd')).toBe(false)
    expect(UPLOAD_NAME_RE.test('x.svg')).toBe(false)
  })
})
