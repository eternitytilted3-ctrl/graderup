import 'server-only'
import type { ExternalIdentity, RedirectAuthProvider } from './AuthProvider'

const STEAM_OPENID = 'https://steamcommunity.com/openid/login'
const CLAIMED_ID_RE = /^https:\/\/steamcommunity\.com\/openid\/id\/(\d{17})$/

/**
 * Steam sign-in via OpenID 2.0 (Steam does not offer OAuth for sign-in).
 * The callback is verified server-to-server with `check_authentication`, so a forged
 * redirect cannot log anyone in. The Web API key is only used server-side for the profile.
 */
export class SteamAuthProvider implements RedirectAuthProvider {
  readonly id = 'steam'
  readonly kind = 'redirect' as const

  constructor(
    private readonly cfg: { enabled: boolean; appUrl: string; apiKey?: string },
  ) {}

  isEnabled() {
    return this.cfg.enabled
  }

  get returnUrl() {
    return `${this.cfg.appUrl}/api/auth/steam/callback`
  }

  getAuthorizationUrl({ state }: { returnTo: string; state: string }) {
    const params = new URLSearchParams({
      'openid.ns': 'http://specs.openid.net/auth/2.0',
      'openid.mode': 'checkid_setup',
      'openid.return_to': `${this.returnUrl}?state=${encodeURIComponent(state)}`,
      'openid.realm': this.cfg.appUrl,
      'openid.identity': 'http://specs.openid.net/auth/2.0/identifier_select',
      'openid.claimed_id': 'http://specs.openid.net/auth/2.0/identifier_select',
    })
    return `${STEAM_OPENID}?${params}`
  }

  async handleCallback(callbackUrl: URL): Promise<ExternalIdentity> {
    const q = callbackUrl.searchParams
    if (q.get('openid.mode') !== 'id_res') throw new Error('Steam login was cancelled')
    const returnTo = q.get('openid.return_to') ?? ''
    if (!returnTo.startsWith(this.returnUrl)) throw new Error('Steam return_to mismatch')
    const claimed = q.get('openid.claimed_id') ?? ''
    const match = CLAIMED_ID_RE.exec(claimed)
    if (!match) throw new Error('Invalid Steam claimed_id')

    // Verify the assertion directly with Steam.
    const verifyParams = new URLSearchParams()
    for (const [k, v] of q) if (k.startsWith('openid.')) verifyParams.set(k, v)
    verifyParams.set('openid.mode', 'check_authentication')
    const res = await fetch(STEAM_OPENID, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: verifyParams,
      signal: AbortSignal.timeout(10_000),
    })
    const text = await res.text()
    if (!/is_valid\s*:\s*true/.test(text)) throw new Error('Steam assertion is not valid')

    const steamId = match[1]
    const identity: ExternalIdentity = { provider: 'steam', providerUserId: steamId }
    const profile = await fetchSteamProfile(steamId, this.cfg.apiKey)
    if (profile) {
      identity.username = profile.name
      identity.avatarUrl = profile.avatar
      identity.profile = { personaname: profile.name, avatar: profile.avatar }
    }
    return identity
  }
}

/** Only Steam's avatar CDN is accepted as an avatar URL. */
const AVATAR_RE = /^https:\/\/(([a-z0-9-]+\.)+steamstatic\.com|steamcdn-a\.akamaihd\.net)\/[\w./-]+$/

const cdata = (xml: string, tag: string) => {
  const m = new RegExp(`<${tag}>\\s*(?:<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>|([^<]*))\\s*</${tag}>`).exec(xml)
  return (m?.[1] ?? m?.[2] ?? '').trim()
}

/**
 * Public nickname + full-size avatar of a Steam account. Uses the Web API when STEAM_API_KEY is set,
 * otherwise the public community profile XML (no key needed; works for public profiles).
 * Best effort: returns null on any failure.
 */
export async function fetchSteamProfile(steamId: string, apiKey?: string): Promise<{ name?: string; avatar?: string } | null> {
  if (!/^\d{17}$/.test(steamId)) return null
  try {
    if (apiKey) {
      const r = await fetch(`https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${encodeURIComponent(apiKey)}&steamids=${steamId}`, { signal: AbortSignal.timeout(8_000) })
      const data = (await r.json()) as { response?: { players?: { personaname?: string; avatarfull?: string }[] } }
      const p = data.response?.players?.[0]
      if (p) return { name: p.personaname, avatar: p.avatarfull && AVATAR_RE.test(p.avatarfull) ? p.avatarfull : undefined }
    }
    const r = await fetch(`https://steamcommunity.com/profiles/${steamId}/?xml=1`, { headers: { accept: 'text/xml' }, signal: AbortSignal.timeout(8_000) })
    if (!r.ok) return null
    const xml = (await r.text()).slice(0, 200_000)
    const name = cdata(xml, 'steamID')
    const avatar = cdata(xml, 'avatarFull')
    if (!name && !avatar) return null
    return { name: name || undefined, avatar: AVATAR_RE.test(avatar) ? avatar : undefined }
  } catch {
    return null
  }
}
