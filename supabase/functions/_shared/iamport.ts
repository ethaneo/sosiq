const IAMPORT_BASE = 'https://api.iamport.kr'

export async function getIamportToken(): Promise<string> {
  const res = await fetch(`${IAMPORT_BASE}/users/getToken`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      imp_key: Deno.env.get('PORTONE_API_KEY'),
      imp_secret: Deno.env.get('PORTONE_API_SECRET'),
    }),
  })
  const json = await res.json()
  if (json.code !== 0) throw new Error('iamport 토큰 발급 실패: ' + json.message)
  return json.response.access_token
}

export async function getPayment(token: string, impUid: string) {
  const res = await fetch(`${IAMPORT_BASE}/payments/${impUid}`, {
    headers: { Authorization: token },
  })
  const json = await res.json()
  if (json.code !== 0) throw new Error('결제 정보 조회 실패: ' + json.message)
  return json.response
}

export async function scheduleNextPayment(
  token: string,
  customerUid: string,
  merchantUid: string,
  scheduleAt: Date,
  amount: number,
  name: string,
  buyerEmail: string,
  buyerName: string,
) {
  const res = await fetch(`${IAMPORT_BASE}/subscribe/payments/schedule`, {
    method: 'POST',
    headers: { Authorization: token, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      customer_uid: customerUid,
      schedules: [{
        merchant_uid: merchantUid,
        schedule_at: Math.floor(scheduleAt.getTime() / 1000),
        amount,
        name,
        buyer_email: buyerEmail,
        buyer_name: buyerName,
      }],
    }),
  })
  return res.json()
}

export async function deleteBillingKey(token: string, customerUid: string) {
  const res = await fetch(`${IAMPORT_BASE}/subscribe/customers/${customerUid}`, {
    method: 'DELETE',
    headers: { Authorization: token },
  })
  return res.json()
}
