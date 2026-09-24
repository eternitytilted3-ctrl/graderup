import { route } from '@/server/http/handler'
import { getCase } from '@/server/services/cases'

export const GET = route({}, async ({ params }) => getCase(params.id))
