/**
 * payment-webhook (Paddle Billing v2)
 *
 * Paddle Dashboard -> Notifications -> Webhook URL:
 *   https://<project>.supabase.co/functions/v1/payment-webhook
 *
 * Events handled:
 *   subscription.created       -> activate user plan
 *   transaction.completed      -> renewal success, keep active
 *   subscription.canceled      -> downgrade to free
 *   subscription.past_due      -> set grace period (3 days)
 *   transaction.payment_failed -> set grace period (3 days)
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { verifyPaddleWebhook, getPlanFromPriceId } from '../_shared/paddle.ts'

const GRACE_DAYS = 3

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })

  const rawBody = await req.text()
  const signature = req.headers.get('Paddle-Signature')

  const isValid = await verifyPaddleWebhook(rawBody, signature)
  if (!isValid) {
    console.error('[paddle-webhook] Invalid signature')
    return new Response('Invalid signature', { status: 401 })
  }

  let event: any
  try {
    event = JSON.parse(rawBody)
  } catch {
    return new Response('Invalid JSON', { status: 400 })
  }

  const eventType: string = event.event_type
  const eventData = event.data

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SB_SERVICE_ROLE_KEY')!,
  )

  try {
    // ── subscription.created: new subscription ──
    if (eventType === 'subscription.created') {
      const subscriptionId: string = eventData.id
      const customerId: string = eventData.customer_id
      const customData = eventData.custom_data ?? {}
      const userId: string = customData.userId
      const priceId: string = eventData.items?.[0]?.price?.id
      const plan = getPlanFromPriceId(priceId)
      const amountCents: number = eventData.items?.[0]?.price?.unit_price?.amount ?? 0

      if (!userId || !plan) {
        console.error('[paddle-webhook] subscription.created: missing userId or plan', customData, priceId)
        return new Response('OK', { status: 200 })
      }

      const { data: dup } = await supabase
        .from('subscriptions')
        .select('id')
        .eq('paddle_subscription_id', subscriptionId)
        .maybeSingle()

      if (!dup) {
        const now = new Date().toISOString()
        await supabase.from('subscriptions').insert({
          user_id: userId,
          plan,
          paddle_subscription_id: subscriptionId,
          amount: amountCents / 100,
          started_at: now,
          status: 'active',
        })
        await supabase.from('users').update({
          is_pro: true,
          plan,
          pro_since: now,
          paddle_customer_id: customerId,
        }).eq('id', userId)
      }
    }

    // ── transaction.completed: successful renewal ──
    else if (eventType === 'transaction.completed') {
      const subscriptionId: string = eventData.subscription_id
      if (!subscriptionId) return new Response('OK', { status: 200 })

      const { data: sub } = await supabase
        .from('subscriptions')
        .select('id, user_id, plan')
        .eq('paddle_subscription_id', subscriptionId)
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (sub) {
        await supabase.from('subscriptions').update({
          status: 'active',
          grace_until: null,
          failed_count: 0,
        }).eq('id', sub.id)

        await supabase.from('users').update({
          is_pro: true,
          plan: sub.plan,
          pro_since: new Date().toISOString(),
        }).eq('id', sub.user_id)
      }
    }

    // ── subscription.canceled: downgrade to free ──
    else if (eventType === 'subscription.canceled') {
      const subscriptionId: string = eventData.id

      const { data: sub } = await supabase
        .from('subscriptions')
        .select('user_id')
        .eq('paddle_subscription_id', subscriptionId)
        .maybeSingle()

      await supabase.from('subscriptions')
        .update({ status: 'cancelled' })
        .eq('paddle_subscription_id', subscriptionId)
        .in('status', ['active', 'grace'])

      if (sub?.user_id) {
        await supabase.from('users').update({ is_pro: false, plan: 'free' }).eq('id', sub.user_id)
      }
    }

    // ── subscription.past_due / transaction.payment_failed: grace period ──
    else if (eventType === 'subscription.past_due' || eventType === 'transaction.payment_failed') {
      const subscriptionId: string = eventData.id ?? eventData.subscription_id
      const graceUntil = new Date()
      graceUntil.setDate(graceUntil.getDate() + GRACE_DAYS)

      const { data: activeSub } = await supabase
        .from('subscriptions')
        .select('id, failed_count')
        .eq('paddle_subscription_id', subscriptionId)
        .eq('status', 'active')
        .maybeSingle()

      if (activeSub) {
        await supabase.from('subscriptions').update({
          status: 'grace',
          grace_until: graceUntil.toISOString(),
          failed_count: (activeSub.failed_count ?? 0) + 1,
        }).eq('id', activeSub.id)
      }

      console.log(`[paddle-webhook] Payment failed — subscription: ${subscriptionId}, grace until: ${graceUntil.toISOString()}`)
    }

  } catch (e) {
    console.error('[paddle-webhook] Error:', e)
    return new Response('Internal Server Error', { status: 500 })
  }

  return new Response('OK', { status: 200 })
})
