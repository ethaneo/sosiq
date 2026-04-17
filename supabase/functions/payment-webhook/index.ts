/**
 * payment-webhook
 *
 * 포트원(iamport)에서 발송하는 결제 웹훅을 수신합니다.
 * 포트원 콘솔 → 웹훅 URL 설정: https://<project>.supabase.co/functions/v1/payment-webhook
 *
 * 처리 케이스:
 *   paid      → 구독 활성화 + 다음 달 예약
 *   failed    → 유예기간(3일) 설정, 3일 후 플랜 다운그레이드
 *   cancelled → 플랜 비활성화
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getIamportToken, getPayment, scheduleNextPayment } from '../_shared/iamport.ts'

const PLAN_AMOUNT: Record<string, number> = { basic: 5900, pro: 9900 }
const PLAN_NAME: Record<string, string> = {
  basic: 'Realations Basic 월 정기구독',
  pro: 'Realations Pro 월 정기구독',
}
const GRACE_DAYS = 3

Deno.serve(async (req) => {
  // 포트원은 GET으로 웹훅 유효성 확인을 하기도 함
  if (req.method === 'GET') return new Response('OK', { status: 200 })
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })

  try {
    const body = await req.json()
    const { imp_uid, merchant_uid } = body

    if (!imp_uid || !merchant_uid) {
      return new Response('imp_uid / merchant_uid 누락', { status: 400 })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SB_SERVICE_ROLE_KEY')!,
    )

    // ── iamport에서 실제 결제 정보 조회 ──
    const token = await getIamportToken()
    const payment = await getPayment(token, imp_uid)
    const status = payment.status // paid | failed | cancelled
    const customerUid: string = payment.customer_uid ?? ''

    // customer_uid 형식: realations_{plan}_{user_id}
    const parts = customerUid.split('_')
    // parts[0]='realations', parts[1]=plan, parts[2..]=user_id (uuid has hyphens, split differently)
    const planFromUid = parts[1] // 'basic' | 'pro'
    const userIdFromUid = parts.slice(2).join('_')

    if (!planFromUid || !userIdFromUid) {
      console.error('[webhook] customer_uid 파싱 실패:', customerUid)
      return new Response('customer_uid 파싱 오류', { status: 400 })
    }

    const now = new Date()

    // ── paid: 갱신 성공 ──
    if (status === 'paid') {
      // 중복 처리 방지
      const { data: dup } = await supabase
        .from('subscriptions')
        .select('id')
        .eq('imp_uid', imp_uid)
        .maybeSingle()

      if (!dup) {
        await supabase.from('subscriptions').insert({
          user_id: userIdFromUid,
          plan: planFromUid,
          imp_uid,
          merchant_uid,
          amount: payment.amount,
          started_at: now.toISOString(),
          status: 'active',
        })
      }

      // users 테이블 pro_since 갱신
      await supabase.from('users').update({
        is_pro: true,
        plan: planFromUid,
        pro_since: now.toISOString(),
        imp_uid,
        merchant_uid,
      }).eq('id', userIdFromUid)

      // 이전 grace 구독 있으면 active로 복구
      await supabase.from('subscriptions')
        .update({ status: 'active', grace_until: null, failed_count: 0 })
        .eq('user_id', userIdFromUid)
        .eq('status', 'grace')

      // 다음 달 예약
      const nextDate = new Date(now)
      nextDate.setMonth(nextDate.getMonth() + 1)
      const nextMerchantUid = `realations_${planFromUid}_${userIdFromUid}_${nextDate.getTime()}`

      await scheduleNextPayment(
        token,
        customerUid,
        nextMerchantUid,
        nextDate,
        PLAN_AMOUNT[planFromUid] ?? payment.amount,
        PLAN_NAME[planFromUid] ?? 'Realations 월 정기구독',
        payment.buyer_email ?? '',
        payment.buyer_name ?? '',
      )
    }

    // ── failed: 갱신 실패 → 유예기간 설정 ──
    else if (status === 'failed') {
      const graceUntil = new Date(now)
      graceUntil.setDate(graceUntil.getDate() + GRACE_DAYS)

      // 기존 active 구독을 grace 상태로 변경
      const { data: activeSub } = await supabase
        .from('subscriptions')
        .select('id, failed_count')
        .eq('user_id', userIdFromUid)
        .eq('status', 'active')
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (activeSub) {
        const newFailCount = (activeSub.failed_count ?? 0) + 1
        await supabase.from('subscriptions').update({
          status: 'grace',
          grace_until: graceUntil.toISOString(),
          failed_count: newFailCount,
        }).eq('id', activeSub.id)
      } else {
        // 활성 구독 없으면 새 grace 레코드 생성
        await supabase.from('subscriptions').insert({
          user_id: userIdFromUid,
          plan: planFromUid,
          imp_uid,
          merchant_uid,
          amount: payment.amount,
          started_at: now.toISOString(),
          status: 'grace',
          grace_until: graceUntil.toISOString(),
          failed_count: 1,
        })
      }

      // 유예기간 3일 후 자동 다운그레이드 예약
      // (로그인 시 체크 방식을 주로 사용, 여기서는 로그 남김)
      console.log(
        `[webhook] 결제 실패 — user: ${userIdFromUid}, 유예기간: ${graceUntil.toISOString()}`,
      )
    }

    // ── cancelled: 구독 취소 ──
    else if (status === 'cancelled') {
      await supabase.from('users').update({
        is_pro: false,
        plan: 'free',
      }).eq('id', userIdFromUid)

      await supabase.from('subscriptions')
        .update({ status: 'cancelled' })
        .eq('user_id', userIdFromUid)
        .in('status', ['active', 'grace'])
    }

    return new Response('OK', { status: 200 })
  } catch (e) {
    console.error('[payment-webhook]', e)
    return new Response('Internal Server Error', { status: 500 })
  }
})
