/**
 * Auth provider abstraction. New providers (Steam, Google, Discord …) plug in here
 * without touching sessions, users or the rest of the app.
 */
export interface ExternalIdentity {
  provider: string
  providerUserId: string
  username?: string
  avatarUrl?: string
  profile?: Record<string, unknown>
}

export interface AuthProviderBase {
  readonly id: string
  readonly kind: 'credentials' | 'redirect'
  isEnabled(): boolean
}

/** Username/email + password style provider. */
export interface CredentialsAuthProvider<TRegister, TLogin> extends AuthProviderBase {
  readonly kind: 'credentials'
  register(input: TRegister): Promise<{ userId: string }>
  authenticate(input: TLogin): Promise<{ userId: string }>
}

/** OAuth/OpenID redirect style provider. */
export interface RedirectAuthProvider extends AuthProviderBase {
  readonly kind: 'redirect'
  getAuthorizationUrl(opts: { returnTo: string; state: string }): string
  /** Verifies the callback with the identity provider (server-to-server) and returns the identity. */
  handleCallback(callbackUrl: URL): Promise<ExternalIdentity>
}
