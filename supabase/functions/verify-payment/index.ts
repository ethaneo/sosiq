import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getIamportToken, getPayment, scheduleNextPayment } from '../_shared/iamport.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const PLAN_AMOUNT: Record<string, number> = { basic: 5900, pro: 9900 }
const PLAN_NAME: Record<string, string> = {
  basic: 'Realations Basic 월 정기구독',
  pro: 'Realations Pro 월 정기구독',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })

  try {
    const { imp_uid, merchant_uid, plan, user_id } = await req.json()

    if (!imp_uid || !merchant_uid || !plan || !user_id) {
      return json({ error: '필수 파라미터 누락' }, 400)
    }
    if (!PLAN_AMOUNT[plan]) {
      return json({ error: '유효하지 않은 플랜' }, 400)
    }

    // ── 1. iamport 결제 정보 서버 조회 ──
    const token = await getIamportToken()
    const payment = await getPayment(token, imp_uid)

    // ── 2. 3중 검증 ──
    if (payment.merchant_uid !== merchant_uid) {
      return json({ error: '거래번호 불일치 — 결제 위변조 의심' }, 400)
    }
    if (payment.amount !== PLAN_AMOUNT[plan]) {
      return json({ error: `결제 금액 불일치 (기대: ${PLAN_AMOUNT[plan]}, 실제: ${payment.amount})` }, 400)
    }
    if (payment.status !== 'paid') {
      return json({ error: `결제 미완료 상태: ${payment.status}` }, 400)
    }

    // ── 3. 중복 처리 방지: imp_uid 이미 DB에 있으면 성공으로 응답 ──
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SB_SERVICE_ROLE_KEY')!,
    )

    const { data: dup } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('imp_uid', imp_uid)
      .maybeSingle()

    if (dup) {
      return json({ success: true, duplicate: true })
    }

    // ── 4. DB 업데이트 ──
    const now = new Date().toISOString()

    const { error: userErr } = await supabase.from('users').update({
      is_pro: true,
      plan,
      pro_since: now,
      imp_uid,
      merchant_uid,
    }).eq('id', user_id)

    if (userErr) throw userErr

    await supabase.from('subscriptions').insert({
      user_id,
      plan,
      imp_uid,
      merchant_uid,
      amount: PLAN_AMOUNT[plan],
      started_at: now,
      status: 'active',
    })

    // ── 5. 다음 달 자동갱신 예약 ──
    const nextDate = new Date()
    nextDate.setMonth(nextDate.getMonth() + 1)
    const customerUid = `realations_${plan}_${user_id}`
    const nextMerchantUid = `realations_${plan}_${user_id}_${nextDate.getTime()}`

    await scheduleNextPayment(
      token,
      customerUid,
      nextMerchantUid,
      nextDate,
      PLAN_AMOUNT[plan],
      PLAN_NAME[plan],
      payment.buyer_email ?? '',
      payment.buyer_name ?? '',
    )

    return json({ success: true })
  } catch (e) {
    console.error('[verify-payment]', e)
    return json({ error: e.message }, 500)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  })
}
