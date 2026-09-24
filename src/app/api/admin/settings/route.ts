import { z } from 'zod'
import { route } from '@/server/http/handler'
import { RateLimits } from '@/server/security/rateLimit'
import { updateSettings } from '@/server/services/admin'
import { getAllSettings, settingSchemas, type SettingKey } from '@/server/services/settings'

const body = z.object({ key: z.enum(Object.keys(settingSchemas) as [SettingKey, ...SettingKey[]]), value: z.unknown() })

export const GET = route({ auth: 'admin', rateLimit: RateLimits.admin }, async () => getAllSettings())
// Changing game economics is restricted to superadmins.
export const PUT = route({ auth: 'superadmin', body, rateLimit: RateLimits.admin }, async ({ auth, body, ip }) => ({
  key: body.key,
  value: await updateSettings(auth.user.id, body.key, body.value, ip),
}))
