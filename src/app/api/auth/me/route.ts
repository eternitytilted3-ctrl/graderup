import { enabledProviders } from '@/server/auth/service'
import { route } from '@/server/http/handler'
import { toPublicUser } from '@/server/services/mappers'

export const GET = route({ auth: 'optional' }, async ({ auth }) => ({
  user: auth ? toPublicUser(auth.user) : null,
  csrfToken: auth?.csrfToken ?? null,
  providers: enabledProviders(),
}))
