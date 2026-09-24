import 'server-only'
import { randomBytes } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { Errors } from '../http/errors'

export const MAX_UPLOAD_BYTES = 3 * 1024 * 1024
export const UPLOAD_NAME_RE = /^[a-f0-9]{32}\.(png|jpg|webp)$/

export function uploadDir() {
  return path.resolve(/* turbopackIgnore: true */ process.cwd(), process.env.UPLOAD_DIR || 'uploads')
}

/** Detects the real type from magic bytes — the client's MIME type / extension are ignored. SVG is never accepted. */
export function sniffImage(buf: Buffer): 'png' | 'jpg' | 'webp' | null {
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png'
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg'
  if (buf.length > 12 && buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP') return 'webp'
  return null
}

export async function saveUpload(buf: Buffer) {
  if (buf.length === 0) throw Errors.badRequest('Пустой файл')
  if (buf.length > MAX_UPLOAD_BYTES) throw Errors.validation({ fields: { file: 'Файл больше 3 МБ' } })
  const ext = sniffImage(buf)
  if (!ext) throw Errors.validation({ fields: { file: 'Допустимы только PNG, JPEG или WebP' } })
  const name = `${randomBytes(16).toString('hex')}.${ext}`
  await mkdir(/* turbopackIgnore: true */ uploadDir(), { recursive: true })
  await writeFile(/* turbopackIgnore: true */ path.join(uploadDir(), name), buf, { flag: 'wx' })
  return { name, url: `/api/uploads/${name}` }
}

export async function readUpload(name: string) {
  if (!UPLOAD_NAME_RE.test(name)) return null
  try {
    return await readFile(/* turbopackIgnore: true */ path.join(uploadDir(), name))
  } catch {
    return null
  }
}
