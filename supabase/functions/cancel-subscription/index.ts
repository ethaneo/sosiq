import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getIamportToken, deleteBillingKey } from '../_shared/iamport.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })

  try {
    const { user_id, plan } = await req.json()

    if (!user_id || !plan) return json({ error: '필수 파라미터 누락' }, 400)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SB_SERVICE_ROLE_KEY')!,
    )

    // ── 1. 포트원 빌링키 삭제 ──
    // customer_uid 형식: realations_{plan}_{user_id}
    const customerUid = `realations_${plan}_${user_id}`
    let billingKeyDeleted = false

    try {
      const token = await getIamportToken()
      const deleteResult = await deleteBillingKey(token, customerUid)
      billingKeyDeleted = deleteResult.code === 0
      if (!billingKeyDeleted) {
        // 빌링키가 없거나 이미 삭제된 경우도 정상 처리
        console.warn('[cancel-subscription] 빌링키 삭제 응답:', deleteResult.message)
      }
    } catch (e) {
      // 포트원 API 실패해도 DB 해지는 진행
      console.error('[cancel-subscription] 빌링키 삭제 오류 (계속 진행):', e.message)
    }

    // ── 2. 예약된 결제 취소 ──
    try {
      const token = await getIamportToken()
      await fetch('https://api.iamport.kr/subscribe/payments/unschedule', {
        method: 'POST',
        headers: { Authorization: token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ customer_uid: customerUid }),
      })
    } catch (e) {
      console.error('[cancel-subscription] 예약결제 취소 오류 (계속 진행):', e.message)
    }

    // ── 3. DB 업데이트: 구독 상태 해지로 변경 ──
    await supabase.from('subscriptions')
      .update({ status: 'cancelled' })
      .eq('user_id', user_id)
      .in('status', ['active', 'grace'])

    // ── 4. users 테이블: plan은 free로 변경하지 않음 ──
    // 해지 후에도 현재 구독 기간 만료까지 서비스 유지 (pro_since 기준)
    // 실제 만료 처리는 로그인 시 pro_since + 30일 체크로 처리
    await supabase.from('users').update({
      merchant_uid: null, // 예약결제 참조 제거
    }).eq('id', user_id)

    return json({ success: true, billingKeyDeleted })
  } catch (e) {
    console.error('[cancel-subscription]', e)
    return json({ error: e.message }, 500)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  })
}
