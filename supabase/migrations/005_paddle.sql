-- Migration 005: Switch from PortOne/KCP to Paddle Billing
-- Run in Supabase SQL Editor

-- Add Paddle columns to users
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS paddle_customer_id TEXT;

-- Add Paddle columns to subscriptions
ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS paddle_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS paddle_transaction_id TEXT;

-- Index for webhook lookup
CREATE INDEX IF NOT EXISTS idx_subscriptions_paddle_sub_id
  ON subscriptions (paddle_subscription_id);
