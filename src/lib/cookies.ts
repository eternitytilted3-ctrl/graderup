/**
 * Cookie names. A second instance on the same host (e.g. the test server on another port — browsers
 * share cookies across ports) is built with NEXT_PUBLIC_COOKIE_PREFIX so its cookies do not clash.
 */
const P = process.env.NEXT_PUBLIC_COOKIE_PREFIX || 'gu'

export const COOKIES = {
  session: `${P}_session`,
  csrf: `${P}_csrf`,
  oauthState: `${P}_oauth_state`,
  ref: `${P}_ref`,
  next: `${P}_next`,
  visitor: `${P}_vid`,
} as const
