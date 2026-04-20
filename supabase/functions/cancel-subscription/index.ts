import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getIamportToken, deleteBillingKey } from '../_shared/iamport.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })

  try {
    // ── C1 FIX: JWT 인증 — 본인 확인 ──
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: '인증 필요' }, 401)

    const sbUser = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    )
    const { data: { user }, error: authErr } = await sbUser.auth.getUser()
    if (authErr || !user) return json({ error: '유효하지 않은 세션' }, 401)

    const { user_id, plan } = await req.json()
    if (!user_id || !plan) return json({ error: '필수 파라미터 누락' }, 400)

    // 요청 user_id와 인증된 사용자 일치 확인 (타인 구독 해지 방지)
    if (user_id !== user.id) return json({ error: '본인 구독만 해지 가능합니다' }, 403)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SB_SERVICE_ROLE_KEY')!,
    )

    // ── 1. 포트원 빌링키 삭제 ──
    const customerUid = `realations_${plan}_${user_id}`
    let billingKeyDeleted = false

    try {
      const token = await getIamportToken()
      const deleteResult = await deleteBillingKey(token, customerUid)
      billingKeyDeleted = deleteResult.code === 0
      if (!billingKeyDeleted) {
        console.warn('[cancel-subscription] 빌링키 삭제 응답 코드:', deleteResult.code)
      }
    } catch (_e) {
      console.error('[cancel-subscription] 빌링키 삭제 오류 (계속 진행)')
    }

    // ── 2. 예약된 결제 취소 ──
    try {
      const token = await getIamportToken()
      await fetch('https://api.iamport.kr/subscribe/payments/unschedule', {
        method: 'POST',
        headers: { Authorization: token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ customer_uid: customerUid }),
      })
    } catch (_e) {
      console.error('[cancel-subscription] 예약결제 취소 오류 (계속 진행)')
    }

    // ── 3. DB 업데이트 ──
    await supabase.from('subscriptions')
      .update({ status: 'cancelled' })
      .eq('user_id', user_id)
      .in('status', ['active', 'grace'])

    await supabase.from('users').update({
      merchant_uid: null,
    }).eq('id', user_id)

    return json({ success: true, billingKeyDeleted })
  } catch (_e) {
    console.error('[cancel-subscription] 처리 오류')
    return json({ error: '해지 처리 중 오류가 발생했습니다' }, 500)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  })
}
