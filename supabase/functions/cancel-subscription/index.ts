import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { cancelPaddleSubscription } from '../_shared/paddle.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Authentication required' }, 401)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SB_SERVICE_ROLE_KEY')!,
    )
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
    if (authErr || !user) return json({ error: 'Invalid session' }, 401)

    const { user_id } = await req.json()
    if (!user_id) return json({ error: 'Missing user_id' }, 400)
    if (user_id !== user.id) return json({ error: 'Can only cancel your own subscription' }, 403)

    // ── 1. Get active Paddle subscription ──
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('paddle_subscription_id')
      .eq('user_id', user_id)
      .eq('status', 'active')
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    let paddleCancelled = false
    if (sub?.paddle_subscription_id) {
      try {
        await cancelPaddleSubscription(sub.paddle_subscription_id)
        paddleCancelled = true
      } catch (_e) {
        console.error('[cancel-subscription] Paddle cancel failed (continuing)')
      }
    }

    // ── 2. Update DB ──
    await supabase.from('subscriptions')
      .update({ status: 'cancelled' })
      .eq('user_id', user_id)
      .in('status', ['active', 'grace'])

    await supabase.from('users').update({
      is_pro: false,
      plan: 'free',
    }).eq('id', user_id)

    return json({ success: true, paddleCancelled })
  } catch (_e) {
    console.error('[cancel-subscription] Error')
    return json({ error: 'Failed to cancel subscription' }, 500)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  })
}
