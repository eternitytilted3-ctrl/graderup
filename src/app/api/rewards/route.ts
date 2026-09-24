import { route } from '@/server/http/handler'
import { listRewards, rewardHistory } from '@/server/services/rewards'

export const GET = route({ auth: 'user' }, async ({ auth }) => {
  const [rewards, history] = await Promise.all([listRewards(auth.user.id), rewardHistory(auth.user.id)])
  return {
    rewards,
    history: history.map((h) => ({ ...h, createdAt: h.createdAt.toISOString() })),
    referralCode: auth.user.referralCode,
  }
})
