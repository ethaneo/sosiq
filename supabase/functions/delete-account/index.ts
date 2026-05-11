import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })

  try {
    // JWT 인증 — admin client로 서버 검증 (ES256 알고리즘 대응)
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: '인증 필요' }, 401)

    const sbAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SB_SERVICE_ROLE_KEY')!,
    )
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authErr } = await sbAdmin.auth.getUser(token)
    if (authErr || !user) return json({ error: '유효하지 않은 세션' }, 401)

    // 요청 body의 user_id와 세션 user.id 일치 확인 (타인 계정 삭제 방지)
    const { user_id } = await req.json()
    if (user_id !== user.id) return json({ error: '본인 계정만 탈퇴 가능합니다' }, 403)

    // 1. 구독 중이면 포트원 빌링키 삭제 시도 (실패해도 탈퇴 진행)
    const { data: userData } = await sbAdmin
      .from('users')
      .select('plan')
      .eq('id', user_id)
      .maybeSingle()

    if (userData?.plan && userData.plan !== 'free') {
      try {
        const { getIamportToken, deleteBillingKey } = await import('../_shared/iamport.ts')
        const token = await getIamportToken()
        await deleteBillingKey(token, `realations_${userData.plan}_${user_id}`)
      } catch (e) {
        console.warn('[delete-account] 빌링키 삭제 실패 (탈퇴 계속 진행):', e.message)
      }
    }

    // 2. DB 데이터 삭제 (subscriptions → users 순서, FK cascade 없을 경우 대비)
    await sbAdmin.from('subscriptions').delete().eq('user_id', user_id)
    await sbAdmin.from('users').delete().eq('id', user_id)

    // 3. Supabase Auth 유저 완전 삭제
    const { error: deleteErr } = await sbAdmin.auth.admin.deleteUser(user_id)
    if (deleteErr) throw deleteErr

    return json({ success: true })
  } catch (e) {
    console.error('[delete-account]', e)
    return json({ error: e.message }, 500)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  })
}
