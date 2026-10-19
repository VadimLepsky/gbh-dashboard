import type { BankPayment, Dataset, Invoice } from './types'

/**
 * Most likely invoices for a bank payment that could not be matched by variable symbol:
 * unpaid invoices with the same amount first, then the closest amounts within 2 %.
 */
export function paymentCandidates(ds: Pick<Dataset, 'invoices'>, payment: BankPayment): Invoice[] {
  const unpaid = ds.invoices.filter((i) => i.paidAt === null && i.issuedAt <= payment.receivedAt)
  const exact = unpaid.filter((i) => i.amount === payment.amount)
  if (exact.length) return exact
  return unpaid
    .filter((i) => Math.abs(i.amount - payment.amount) / payment.amount <= 0.02)
    .sort((a, b) => Math.abs(a.amount - payment.amount) - Math.abs(b.amount - payment.amount))
}
