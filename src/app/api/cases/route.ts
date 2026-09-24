import { route } from '@/server/http/handler'
import { listCases } from '@/server/services/cases'

export const GET = route({}, async () => ({ items: await listCases() }))
