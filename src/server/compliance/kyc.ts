import 'server-only'
import { env } from '@/config/env'
import { D } from '@/lib/money'
import { AppError } from '../http/errors'
import type { SessionUser } from '../auth/session'

/**
 * KYC/AML hooks. Default implementation only enforces the configured threshold;
 * plug a real KYC vendor in `KycProvider` (Sumsub, Onfido, Veriff …) before production.
 * ⚠️ Пороговые значения и процедуры AML определяются юристом/комплаенс-офицером.
 */
export interface KycProvider {
  id: string
  /** Returns a URL/token to start verification for the user. */
  startVerification(user: SessionUser): Promise<{ url: string } | null>
}

export class NoopKycProvider implements KycProvider {
  id = 'none'
  async startVerification() {
    return null
  }
}

export function getKycProvider(): KycProvider {
  // TODO: return a real vendor adapter based on env().KYC_PROVIDER.
  return new NoopKycProvider()
}

/** Called before a withdrawal is created. Throws if KYC is required but not passed. */
export function assertWithdrawalAllowed(user: Pick<SessionUser, 'kycStatus'>, amount: string) {
  const threshold = env().KYC_WITHDRAW_THRESHOLD
  if (threshold > 0 && D(amount).gt(threshold) && user.kycStatus !== 'verified') {
    throw new AppError(403, 'KYC_REQUIRED', `Для вывода суммы больше $${threshold} требуется верификация личности (KYC)`)
  }
}

/** AML screening hook for deposits/withdrawals. Returns true if the operation must be held for manual review. */
export async function amlScreen(op: { userId: string; type: 'deposit' | 'withdraw'; amount: string }): Promise<boolean> {
  // TODO: integrate sanctions / velocity screening. Default: never auto-flag.
  void op
  return false
}
