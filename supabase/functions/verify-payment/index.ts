import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getIamportToken, getPayment, requestBillingPayment, scheduleNextPayment } from '../_shared/iamport.ts'

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
    // ── C2 FIX: JWT 인증 — 타인 결제로 내 계정 업그레이드 방지 ──
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: '인증 필요' }, 401)

    const sbUser = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    )
    const { data: { user }, error: authErr } = await sbUser.auth.getUser()
    if (authErr || !user) return json({ error: '유효하지 않은 세션' }, 401)

    const { imp_uid, merchant_uid, customer_uid, plan, user_id, force_initial_charge } = await req.json()

    if (!merchant_uid || !plan || !user_id) {
      return json({ error: '필수 파라미터 누락' }, 400)
    }
    if (!PLAN_AMOUNT[plan]) {
      return json({ error: '유효하지 않은 플랜' }, 400)
    }
    // 요청 user_id와 인증된 사용자 일치 확인 (타인 결제로 본인 플랜 업그레이드 방지)
    if (user_id !== user.id) return json({ error: '본인 결제만 처리 가능합니다' }, 403)

    const token = await getIamportToken()
    const customerUid = customer_uid || `realations_${plan}_${user_id}`

    // ── 1. 최초 결제면 실제 청구 수행, 기존 imp_uid가 있으면 그대로 검증 ──
    let finalImpUid = imp_uid
    const shouldRequestInitialCharge = force_initial_charge === true || !finalImpUid
    if (shouldRequestInitialCharge) {
      const paid = await requestBillingPayment(
        token,
        customerUid,
        merchant_uid,
        PLAN_AMOUNT[plan],
        PLAN_NAME[plan],
        user.email ?? '',
        user.email ?? '',
      )
      finalImpUid = paid.imp_uid
      if (!finalImpUid) {
        return json({ error: '결제 승인 결과에 imp_uid가 없습니다' }, 400)
      }
    }

    const payment = await getPayment(token, finalImpUid)

    // ── 2. 3중 검증 ──
    console.log('[verify-payment] status:', payment.status, '| amount:', payment.amount, '| merchant_uid(portone):', payment.merchant_uid, '| merchant_uid(req):', merchant_uid)
    if (payment.merchant_uid !== merchant_uid) {
      return json({ error: '거래번호 불일치 — 결제 위변조 의심' }, 400)
    }
    if (payment.amount !== PLAN_AMOUNT[plan]) {
      return json({ error: '결제 금액 불일치' }, 400)
    }
    if (payment.status !== 'paid') {
      return json({ error: `결제 미완료 상태: ${payment.status}` }, 400)
    }

    // ── 3. 중복 처리 방지 ──
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SB_SERVICE_ROLE_KEY')!,
    )

    const { data: dup } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('imp_uid', finalImpUid)
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
      imp_uid: finalImpUid,
      merchant_uid,
    }).eq('id', user_id)

    if (userErr) throw userErr

    await supabase.from('subscriptions').insert({
      user_id,
      plan,
      imp_uid: finalImpUid,
      merchant_uid,
      amount: PLAN_AMOUNT[plan],
      started_at: now,
      status: 'active',
    })

    // ── 5. 다음 달 자동갱신 예약 ──
    const nextDate = new Date()
    nextDate.setMonth(nextDate.getMonth() + 1)
    const uid8 = user_id.replace(/-/g, '').substring(0, 8)
    const prefix = plan === 'pro' ? 'rp' : 'rb'
    const nextMerchantUid = `${prefix}_${uid8}_${nextDate.getTime()}`        // KCP 주문번호 40자 제한 (25자)

    let warning: string | null = null
    try {
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
    } catch (scheduleErr) {
      warning = scheduleErr instanceof Error ? scheduleErr.message : '다음 결제 예약 실패'
      console.error('[verify-payment] 자동갱신 예약 오류:', warning)
    }

    return json({ success: true, warning })
  } catch (e) {
    const message = e instanceof Error ? e.message : '결제 검증 중 오류가 발생했습니다'
    console.error('[verify-payment] 처리 오류:', message)
    return json({ error: message }, 500)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  })
}
