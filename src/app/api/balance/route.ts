import { route } from '@/server/http/handler'

export const GET = route({ auth: 'user' }, async ({ auth }) => ({ balance: auth.user.balance }))
