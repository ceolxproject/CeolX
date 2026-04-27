import { sendEmail } from '../send.js';

interface PaymentConfirmationParams {
  to: string;
  amount: string;
  planName: string;
  nextBillingDate: string;
  manageUrl: string;
  userName?: string;
  invoiceUrl?: string;
}

/**
 * Dispatch the payment-confirmation template. Intended caller: the Stripe
 * webhook handler for `invoice.payment_succeeded`. Scaffold-only in V1 — the
 * webhook itself is implemented in M8-T2.
 */
export async function sendPaymentConfirmationEmail({
  to,
  amount,
  planName,
  nextBillingDate,
  manageUrl,
  userName = '',
  invoiceUrl,
}: PaymentConfirmationParams): Promise<void> {
  await sendEmail({
    to,
    template: 'payment-confirmation',
    data: {
      userName,
      amount,
      planName,
      nextBillingDate,
      manageUrl,
      ...(invoiceUrl ? { invoiceUrl } : {}),
    },
  });
}
