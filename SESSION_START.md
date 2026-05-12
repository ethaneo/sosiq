# Realations Session Start

Read this file first in a new session. For detailed history see `CLAUDE.md`.

## Current State
- **Project**: Realations
- **Path**: `/Users/mac/Desktop/리얼레이션스`
- **Domain**: `https://realation.world`
- **GitHub**: `ethaneo/sosiq`
- **Deploy**: Vercel (auto-deploy on push to main)
- **Backend**: Supabase (`jyiohkrbdjuwdjjatkgb`)
- **Payment**: Paddle Billing v2 (client token + webhooks)
- **Auth**: Email/password + Google OAuth (Kakao removed)
- **Language**: English-only (i18n system removed)
- **Latest commit**: `7ced3a2` — complete English conversion + Paddle migration

## What Was Done
- Replaced PortOne/KCP with Paddle Billing v2 throughout
- Removed Kakao login and language switcher
- Converted all UI to English (guides, modals, alerts, stat cards, pricing)
- Created `supabase/functions/_shared/paddle.ts` (webhook verify, cancel API)
- Rewrote `payment-webhook`, `cancel-subscription`, `delete-account` edge functions
- Added `supabase/migrations/005_paddle.sql` (paddle columns + index)
- Pricing: $4.99/mo Basic, $7.99/mo Pro (USD)

## Pending Before Going Live
1. **Run migration**: execute `005_paddle.sql` in Supabase SQL Editor
2. **Add Supabase secrets**: `PADDLE_API_KEY`, `PADDLE_WEBHOOK_SECRET`, `PADDLE_BASIC_PRICE_ID`, `PADDLE_PRO_PRICE_ID`
3. **Fill in index.html vars**: `PADDLE_CLIENT_TOKEN`, `PADDLE_BASIC_PRICE_ID`, `PADDLE_PRO_PRICE_ID` (around line 1450)
4. **Deploy edge functions**: `supabase functions deploy payment-webhook cancel-subscription delete-account`
5. **Register webhook URL** in Paddle Dashboard → Notifications
6. **E2E payment test** (Basic + Pro checkout flow)
7. **Cancel subscription test**

## Rules
- Check this file + `CLAUDE.md` at the start of each session.
- Overwrite, don't append — keep entries current not cumulative.
- After code changes: verify syntax, confirm deploy state.

## Quick Check Commands
```
git log --oneline -3
git status --short
```
