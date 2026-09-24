import { NextResponse, type NextRequest } from 'next/server'
import { errorResponse } from '@/server/http/handler'
import { Errors } from '@/server/http/errors'
import { enforceRateLimit } from '@/server/security/rateLimit'
import { clientIp } from '@/server/security/request'
import { handleWebhook } from '@/server/services/payments'

/** Server-to-server provider notification. Authenticated by signature, not by cookies/CSRF. */
export async function POST(req: NextRequest, ctx: { params: Promise<{ provider: string }> }) {
  try {
    const { provider } = await ctx.params
    if (!['mock', 'real'].includes(provider)) throw Errors.notFound()
    const ip = clientIp(req)
    await enforceRateLimit({ name: 'webhook', limit: 600, windowSec: 60 }, `ip:${ip}`)
    const raw = await req.text()
    if (raw.length > 64_000) throw Errors.badRequest('Payload too large')
    const result = await handleWebhook(provider, raw, req.headers, ip)
    return NextResponse.json(result)
  } catch (err) {
    return errorResponse(err, req)
  }
}
