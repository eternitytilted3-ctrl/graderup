import { route } from '@/server/http/handler'
import { getUserItem } from '@/server/services/inventory'

export const GET = route({ auth: 'user' }, async ({ auth, params }) => getUserItem(auth.user.id, params.id))
