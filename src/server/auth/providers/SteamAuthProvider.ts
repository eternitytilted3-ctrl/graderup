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
    if (this.cfg.apiKey) {
      try {
        const r = await fetch(
          `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${encodeURIComponent(this.cfg.apiKey)}&steamids=${steamId}`,
          { signal: AbortSignal.timeout(10_000) },
        )
        const data = (await r.json()) as { response?: { players?: { personaname?: string; avatarfull?: string }[] } }
        const p = data.response?.players?.[0]
        if (p) {
          identity.username = p.personaname
          identity.avatarUrl = p.avatarfull
          identity.profile = { personaname: p.personaname }
        }
      } catch {
        // Profile enrichment is optional.
      }
    }
    return identity
  }
}
