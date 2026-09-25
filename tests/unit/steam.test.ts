import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchSteamProfile } from '@/server/auth/providers/SteamAuthProvider'
import { sanitizeNickname } from '@/server/auth/service'

describe('Steam nickname', () => {
  it('keeps Cyrillic, spaces and simple symbols; strips markup and invisible chars', () => {
    expect(sanitizeNickname('  Вася   Пупкин ')).toBe('Вася Пупкин')
    expect(sanitizeNickname('s1mple')).toBe('s1mple')
    expect(sanitizeNickname('<script>x</script>​')).toBe('scriptxscript')
    expect(sanitizeNickname('ОченьДлинныйНикКоторыйНеВлезает123')).toHaveLength(24)
  })
  it('rejects empty and staff-like names', () => {
    expect(sanitizeNickname('')).toBeNull()
    expect(sanitizeNickname('A')).toBeNull()
    expect(sanitizeNickname('Admin')).toBeNull()
    expect(sanitizeNickname('sup port')).toBeNull()
  })
})

describe('Steam profile without API key (public XML)', () => {
  afterEach(() => vi.unstubAllGlobals())
  it('reads nickname and avatar (Steam CDN hosts only)', async () => {
    const xml = (avatar: string) =>
      `<?xml version="1.0"?><profile><steamID64>76561198000000001</steamID64><steamID><![CDATA[Кибер Котлета]]></steamID><avatarFull><![CDATA[${avatar}]]></avatarFull></profile>`
    vi.stubGlobal('fetch', vi.fn(async () => new Response(xml('https://avatars.fastly.steamstatic.com/abc_full.jpg'))))
    expect(await fetchSteamProfile('76561198000000001')).toEqual({ name: 'Кибер Котлета', avatar: 'https://avatars.fastly.steamstatic.com/abc_full.jpg' })
    vi.stubGlobal('fetch', vi.fn(async () => new Response(xml('https://avatars.steamstatic.com/abc_full.jpg'))))
    expect(await fetchSteamProfile('76561198000000001')).toEqual({ name: 'Кибер Котлета', avatar: 'https://avatars.steamstatic.com/abc_full.jpg' })
    vi.stubGlobal('fetch', vi.fn(async () => new Response(xml('https://steamstatic.com.evil.example/x.jpg'))))
    expect((await fetchSteamProfile('76561198000000001'))?.avatar).toBeUndefined()
  })
})
