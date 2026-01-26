-- Migration: Add Payment Requests and Financial Features
-- Date: 2026-01-26
-- Description: Add payment_requests table for BDE->Student invoices using BDE's CREDITS wallet.

-- ========================================
-- 1. Create Payment Requests Table
-- ========================================
CREATE TABLE IF NOT EXISTS payment_requests (
    request_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bde_group_id UUID REFERENCES groups(group_id),
    student_user_id UUID REFERENCES users(user_id),
    amount DECIMAL(20, 8) NOT NULL,
    status VARCHAR(50) DEFAULT 'PENDING',  -- PENDING, PAID, REJECTED, CANCELLED
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_payment_req_student ON payment_requests(student_user_id);
CREATE INDEX IF NOT EXISTS idx_payment_req_bde ON payment_requests(bde_group_id);

-- ========================================
-- 2. Ensure BDE has EUR Wallet for Revenue
-- ========================================
-- Note: Logic handled in PaymentService, but ensuring we have at least one EUR wallet if groups exist
DO $$
DECLARE
    group_rec RECORD;
BEGIN
    FOR group_rec IN SELECT * FROM groups LOOP
        -- Check if group has EUR wallet
        IF NOT EXISTS (SELECT 1 FROM wallets WHERE group_id = group_rec.group_id AND currency = 'EUR') THEN
            INSERT INTO wallets (wallet_id, group_id, currency, balance, status)
            VALUES (gen_random_uuid(), group_rec.group_id, 'EUR', 0.00, 'active');
        END IF;
    END LOOP;
END $$;
