import { route } from '@/server/http/handler'
import { getProfile } from '@/server/services/profile'

export const GET = route({ auth: 'user' }, async ({ auth }) => getProfile(auth.user.id))
