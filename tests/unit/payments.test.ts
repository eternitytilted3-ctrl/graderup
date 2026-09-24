import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { AnyPayPaymentProvider } from '@/server/payments/AnyPayPaymentProvider'
import { PallyPaymentProvider } from '@/server/payments/PallyPaymentProvider'

describe('Pally postback', () => {
  const p = new PallyPaymentProvider({ apiToken: 'tok', shopId: 's1', apiUrl: 'https://example.invalid' })
  const inv = '11111111-1111-4111-8111-111111111111'
  const sig = createHash('md5').update(`500.00:${inv}:tok`).digest('hex').toUpperCase()
  it('accepts a correctly signed success postback', async () => {
    const e = await p.verifyWebhook(new URLSearchParams({ InvId: inv, OutSum: '500.00', Status: 'SUCCESS', SignatureValue: sig }).toString())
    expect(e).toMatchObject({ paymentId: inv, status: 'completed', amount: '500.00' })
  })
  it('rejects tampered amount or bad signature', async () => {
    await expect(p.verifyWebhook(new URLSearchParams({ InvId: inv, OutSum: '50000.00', Status: 'SUCCESS', SignatureValue: sig }).toString())).rejects.toThrow()
    await expect(p.verifyWebhook(new URLSearchParams({ InvId: inv, OutSum: '500.00', Status: 'SUCCESS', SignatureValue: 'X' }).toString())).rejects.toThrow()
  })
})

describe('AnyPay notification', () => {
  const p = new AnyPayPaymentProvider({ merchantId: '42', secretKey: 'sec', allowedIps: ['1.2.3.4'] })
  const fields = { merchant_id: '42', pay_id: 'abc', amount: '300.00', currency: 'RUB', status: 'paid' }
  const sign = createHash('sha256').update(`RUB:300.00:abc:42:paid:sec`).digest('hex')
  it('accepts valid sign from an allowed IP', async () => {
    const e = await p.verifyWebhook(new URLSearchParams({ ...fields, sign }).toString(), new Headers(), '1.2.3.4')
    expect(e).toMatchObject({ paymentId: 'abc', status: 'completed', amount: '300.00' })
  })
  it('rejects wrong IP, merchant or sign', async () => {
    await expect(p.verifyWebhook(new URLSearchParams({ ...fields, sign }).toString(), new Headers(), '9.9.9.9')).rejects.toThrow()
    await expect(p.verifyWebhook(new URLSearchParams({ ...fields, merchant_id: '43', sign }).toString(), new Headers(), '1.2.3.4')).rejects.toThrow()
    await expect(p.verifyWebhook(new URLSearchParams({ ...fields, amount: '3000.00', sign }).toString(), new Headers(), '1.2.3.4')).rejects.toThrow()
  })
  it('builds a signed payment form URL', async () => {
    const c = await p.createCheckout({ paymentId: 'abc', userId: 'u', amount: '300.00', currency: 'RUB', returnUrl: 'https://x/deposit', webhookUrl: 'https://x/hook' })
    const u = new URL(c.checkoutUrl)
    expect(u.host).toBe('anypay.io')
    expect(u.searchParams.get('sign')).toBe(createHash('sha256').update('42:abc:300.00:RUB:Пополнение баланса GraderUP:https://x/deposit:https://x/deposit:sec').digest('hex'))
  })
})
