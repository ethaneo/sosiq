const PADDLE_API_BASE = 'https://api.paddle.com'

export async function cancelPaddleSubscription(subscriptionId: string): Promise<void> {
  const apiKey = Deno.env.get('PADDLE_API_KEY')!
  const res = await fetch(`${PADDLE_API_BASE}/subscriptions/${subscriptionId}/cancel`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ effective_from: 'next_billing_period' }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`Paddle cancel failed: ${JSON.stringify(err)}`)
  }
}

export async function verifyPaddleWebhook(rawBody: string, signatureHeader: string | null): Promise<boolean> {
  if (!signatureHeader) return false
  const webhookSecret = Deno.env.get('PADDLE_WEBHOOK_SECRET')
  if (!webhookSecret) return false

  const parts = signatureHeader.split(';')
  const tsPart = parts.find((p) => p.startsWith('ts='))
  const h1Part = parts.find((p) => p.startsWith('h1='))
  if (!tsPart || !h1Part) return false

  const ts = tsPart.slice(3)
  const receivedSignature = h1Part.slice(3)

  const signedPayload = `${ts}:${rawBody}`
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(webhookSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signatureBuffer = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signedPayload))
  const computedSignature = Array.from(new Uint8Array(signatureBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')

  return computedSignature === receivedSignature
}

export function getPlanFromPriceId(priceId: string | undefined): string | null {
  if (!priceId) return null
  if (priceId === Deno.env.get('PADDLE_BASIC_PRICE_ID')) return 'basic'
  if (priceId === Deno.env.get('PADDLE_PRO_PRICE_ID')) return 'pro'
  return null
}
