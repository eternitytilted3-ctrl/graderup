import { z } from 'zod'
import { getDb } from '@/server/db/client'
import { route } from '@/server/http/handler'
import { RateLimits } from '@/server/security/rateLimit'
import { logAdmin } from '@/server/services/log'
import { getSetting, setSetting } from '@/server/services/settings'

export const POST = route({ auth: 'admin', body: z.object({ enabled: z.boolean() }), rateLimit: RateLimits.admin }, async ({ auth, body, ip }) =>
  getDb().transaction(async (tx) => {
    const cfg = await getSetting('skinWithdraw', tx)
    const saved = await setSetting(tx, 'skinWithdraw', { ...cfg, enabled: body.enabled }, auth.user.id)
    await logAdmin(tx, { adminId: auth.user.id, action: body.enabled ? 'skin_withdraw_open' : 'skin_withdraw_close', targetType: 'setting', targetId: 'skinWithdraw', ip })
    return saved
  }),
)
