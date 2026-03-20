-- Epicoin Exchange System - Database Schema
-- PostgreSQL 14+

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enums
CREATE TYPE wallet_status AS ENUM ('active', 'suspended', 'closed');
CREATE TYPE transaction_type AS ENUM ('P2P', 'MERCHANT', 'CASHIN', 'CASHOUT');
CREATE TYPE transaction_direction AS ENUM ('outgoing', 'incoming');
CREATE TYPE transaction_status AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'CANCELED');
CREATE TYPE group_status AS ENUM ('active', 'suspended');

-- Groups Table
CREATE TABLE groups (
    group_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_name VARCHAR(255) NOT NULL UNIQUE,
    admin_user_id UUID,
    status group_status DEFAULT 'active',
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_groups_status ON groups(status);
CREATE INDEX idx_groups_admin ON groups(admin_user_id);

-- Wallets Table
CREATE TABLE wallets (
    wallet_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID,
    group_id UUID REFERENCES groups(group_id) ON DELETE CASCADE,
    balance DECIMAL(20, 8) DEFAULT 0.00000000 CHECK (balance >= 0),
    currency VARCHAR(10) DEFAULT 'EPIC',
    status wallet_status DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_wallets_user ON wallets(user_id);
CREATE INDEX idx_wallets_group ON wallets(group_id);
CREATE INDEX idx_wallets_status ON wallets(status);

-- Transactions Table
CREATE TABLE transactions (
    transaction_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    provider VARCHAR(100),
    provider_tx_id VARCHAR(255),
    initiator_user_id UUID,
    source_wallet_id UUID REFERENCES wallets(wallet_id),
    destination_wallet_id UUID REFERENCES wallets(wallet_id),
    amount DECIMAL(20, 8) NOT NULL CHECK (amount > 0),
    currency VARCHAR(10) DEFAULT 'EPIC',
    transaction_type transaction_type NOT NULL,
    direction transaction_direction NOT NULL,
    status transaction_status DEFAULT 'PENDING',
    reason_code VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    provider_created_at TIMESTAMP WITH TIME ZONE,
    executed_at TIMESTAMP WITH TIME ZONE,
    country VARCHAR(3),
    city VARCHAR(255),
    description TEXT,
    metadata JSONB DEFAULT '{}',
    
    -- Constraints
    -- Allow NULL source/destination for external deposits/withdrawals.
    CONSTRAINT different_wallets CHECK (
        source_wallet_id IS NULL
        OR destination_wallet_id IS NULL
        OR source_wallet_id != destination_wallet_id
    )
);

CREATE INDEX idx_transactions_source ON transactions(source_wallet_id);
CREATE INDEX idx_transactions_destination ON transactions(destination_wallet_id);
CREATE INDEX idx_transactions_status ON transactions(status);
CREATE INDEX idx_transactions_type ON transactions(transaction_type);
CREATE INDEX idx_transactions_created ON transactions(created_at DESC);
CREATE INDEX idx_transactions_provider ON transactions(provider, provider_tx_id);
CREATE INDEX idx_transactions_initiator ON transactions(initiator_user_id);

-- Group Trust Scores Table
CREATE TABLE group_trust_scores (
    trust_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    from_group_id UUID REFERENCES groups(group_id) ON DELETE CASCADE,
    to_group_id UUID REFERENCES groups(group_id) ON DELETE CASCADE,
    trust_score DECIMAL(5, 2) DEFAULT 50.00 CHECK (trust_score >= 0 AND trust_score <= 100),
    total_transactions INTEGER DEFAULT 0,
    total_volume DECIMAL(20, 8) DEFAULT 0.00000000,
    successful_transactions INTEGER DEFAULT 0,
    failed_transactions INTEGER DEFAULT 0,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Each pair of groups should have unique trust relationship
    CONSTRAINT unique_trust_relationship UNIQUE (from_group_id, to_group_id),
    CONSTRAINT different_groups CHECK (from_group_id != to_group_id)
);

CREATE INDEX idx_trust_from_group ON group_trust_scores(from_group_id);
CREATE INDEX idx_trust_to_group ON group_trust_scores(to_group_id);
CREATE INDEX idx_trust_score ON group_trust_scores(trust_score);

-- Exchange Rules Table
CREATE TABLE exchange_rules (
    rule_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    from_group_id UUID REFERENCES groups(group_id) ON DELETE CASCADE,
    to_group_id UUID REFERENCES groups(group_id) ON DELETE CASCADE,
    max_transaction_amount DECIMAL(20, 8),
    daily_limit DECIMAL(20, 8),
    requires_approval BOOLEAN DEFAULT false,
    commission_rate DECIMAL(5, 4) DEFAULT 0.0000 CHECK (commission_rate >= 0 AND commission_rate <= 1),
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Each pair of groups should have unique exchange rules
    CONSTRAINT unique_exchange_rule UNIQUE (from_group_id, to_group_id)
);

CREATE INDEX idx_rules_from_group ON exchange_rules(from_group_id);
CREATE INDEX idx_rules_to_group ON exchange_rules(to_group_id);
CREATE INDEX idx_rules_active ON exchange_rules(active);

-- Audit Log Table (for transparency)
CREATE TABLE audit_logs (
    log_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,
    action VARCHAR(50) NOT NULL,
    performed_by UUID,
    changes JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_audit_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_created ON audit_logs(created_at DESC);

-- Functions and Triggers

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_groups_timestamp
    BEFORE UPDATE ON groups
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_wallets_timestamp
    BEFORE UPDATE ON wallets
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_exchange_rules_timestamp
    BEFORE UPDATE ON exchange_rules
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Audit logging trigger
CREATE OR REPLACE FUNCTION log_transaction_changes()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO audit_logs (entity_type, entity_id, action, performed_by, changes)
        VALUES ('transaction', NEW.transaction_id, 'CREATE', NEW.initiator_user_id, row_to_json(NEW)::jsonb);
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO audit_logs (entity_type, entity_id, action, performed_by, changes)
        VALUES ('transaction', NEW.transaction_id, 'UPDATE', NEW.initiator_user_id, 
                jsonb_build_object('old', row_to_json(OLD)::jsonb, 'new', row_to_json(NEW)::jsonb));
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_transaction_changes
    AFTER INSERT OR UPDATE ON transactions
    FOR EACH ROW
    EXECUTE FUNCTION log_transaction_changes();

-- Views for common queries

-- Wallet balance with pending transactions
CREATE VIEW wallet_balances_with_pending AS
SELECT 
    w.wallet_id,
    w.balance as confirmed_balance,
    w.balance + COALESCE(SUM(CASE 
        WHEN t.destination_wallet_id = w.wallet_id AND t.status = 'PENDING' THEN t.amount
        WHEN t.source_wallet_id = w.wallet_id AND t.status = 'PENDING' THEN -t.amount
        ELSE 0
    END), 0) as available_balance
FROM wallets w
LEFT JOIN transactions t ON (w.wallet_id = t.source_wallet_id OR w.wallet_id = t.destination_wallet_id)
GROUP BY w.wallet_id, w.balance;

-- Group transaction statistics
CREATE VIEW group_transaction_stats AS
SELECT 
    g.group_id,
    g.group_name,
    COUNT(DISTINCT w.wallet_id) as total_wallets,
    COUNT(t.transaction_id) as total_transactions,
    SUM(CASE WHEN t.status = 'SUCCESS' THEN t.amount ELSE 0 END) as total_volume,
    AVG(CASE WHEN t.status = 'SUCCESS' THEN t.amount ELSE NULL END) as avg_transaction_amount
FROM groups g
LEFT JOIN wallets w ON g.group_id = w.group_id
LEFT JOIN transactions t ON (w.wallet_id = t.source_wallet_id OR w.wallet_id = t.destination_wallet_id)
GROUP BY g.group_id, g.group_name;

-- Sample Data (optional, for development)
-- INSERT INTO groups (group_name, admin_user_id) 
-- VALUES 
--     ('Epicentre Paris', uuid_generate_v4()),
--     ('Epicentre Lyon', uuid_generate_v4()),
--     ('Epicentre Marseille', uuid_generate_v4());

COMMENT ON TABLE transactions IS 'Main transaction log with complete traceability';
COMMENT ON TABLE wallets IS 'User and group wallets holding Epicoin balances';
COMMENT ON TABLE groups IS 'Communities participating in the Epicoin exchange system';
COMMENT ON TABLE group_trust_scores IS 'Reputation scores between groups based on transaction history';
COMMENT ON TABLE exchange_rules IS 'Rules governing inter-group transactions';

-- ========================================
-- Stripe idempotency + atomic RPC
-- ========================================

-- Marker table to ensure Stripe sessions are fulfilled exactly once.
CREATE TABLE IF NOT EXISTS stripe_checkout_processed_sessions (
    stripe_session_id TEXT PRIMARY KEY,
    user_id UUID NOT NULL,
    bde_group_id UUID,
    credits_amount DECIMAL(20, 8) NOT NULL,
    amount_eur DECIMAL(20, 8) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Atomically process a pending transaction: debit+credit and set status SUCCESS/FAILED.
CREATE OR REPLACE FUNCTION rpc_process_transaction_atomic(p_transaction_id UUID)
RETURNS transactions
LANGUAGE plpgsql
AS $$
DECLARE
    tx transactions%ROWTYPE;
    src wallets%ROWTYPE;
    dst wallets%ROWTYPE;
    result_tx transactions%ROWTYPE;
BEGIN
    SELECT * INTO tx
    FROM transactions
    WHERE transaction_id = p_transaction_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Transaction not found: %', p_transaction_id;
    END IF;

    IF tx.status <> 'PENDING' THEN
        RETURN tx;
    END IF;

    SELECT * INTO src
    FROM wallets
    WHERE wallet_id = tx.source_wallet_id
    FOR UPDATE;

    SELECT * INTO dst
    FROM wallets
    WHERE wallet_id = tx.destination_wallet_id
    FOR UPDATE;

    IF src.status <> 'active' OR dst.status <> 'active' THEN
        RAISE EXCEPTION 'Wallet not active';
    END IF;

    IF src.balance < tx.amount THEN
        RAISE EXCEPTION 'Insufficient funds';
    END IF;

    -- Debit source
    UPDATE wallets
    SET balance = balance - tx.amount
    WHERE wallet_id = src.wallet_id
      AND status = 'active';

    -- Credit destination
    UPDATE wallets
    SET balance = balance + tx.amount
    WHERE wallet_id = dst.wallet_id
      AND status = 'active';

    UPDATE transactions
    SET status = 'SUCCESS',
        executed_at = NOW()
    WHERE transaction_id = p_transaction_id;

    SELECT * INTO result_tx
    FROM transactions
    WHERE transaction_id = p_transaction_id;

    RETURN result_tx;
EXCEPTION
    WHEN others THEN
        UPDATE transactions
        SET status = 'FAILED',
            reason_code = SQLERRM,
            executed_at = NOW()
        WHERE transaction_id = p_transaction_id;

        SELECT * INTO result_tx
        FROM transactions
        WHERE transaction_id = p_transaction_id;

        RETURN result_tx;
END;
$$;

-- Atomically respond to a payment request (PAY) by debiting student and crediting BDE.
CREATE OR REPLACE FUNCTION rpc_respond_payment_request_atomic(p_request_id UUID, p_student_user_id UUID)
RETURNS payment_requests
LANGUAGE plpgsql
AS $$
DECLARE
    req payment_requests%ROWTYPE;
    src_wallet wallets%ROWTYPE;
    dst_wallet wallets%ROWTYPE;
    result_req payment_requests%ROWTYPE;
    bde_group_id UUID;
BEGIN
    SELECT * INTO req
    FROM payment_requests
    WHERE request_id = p_request_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Payment request not found: %', p_request_id;
    END IF;

    IF req.student_user_id <> p_student_user_id THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    IF req.status <> 'PENDING' THEN
        RETURN req;
    END IF;

    bde_group_id := req.bde_group_id;

    SELECT * INTO src_wallet
    FROM wallets
    WHERE user_id = p_student_user_id
      AND currency = 'CREDITS'
      AND status = 'active'
    LIMIT 1
    FOR UPDATE;

    IF src_wallet.wallet_id IS NULL THEN
        RAISE EXCEPTION 'No CREDITS wallet found for student';
    END IF;

    SELECT * INTO dst_wallet
    FROM wallets
    WHERE group_id = bde_group_id
      AND user_id IS NULL
      AND currency = 'CREDITS'
      AND status = 'active'
    LIMIT 1
    FOR UPDATE;

    -- Ensure destination BDE CREDITS wallet exists.
    IF dst_wallet.wallet_id IS NULL THEN
        INSERT INTO wallets (group_id, user_id, currency, balance, status)
        VALUES (bde_group_id, NULL, 'CREDITS', 0.00000000, 'active');

        SELECT * INTO dst_wallet
        FROM wallets
        WHERE group_id = bde_group_id
          AND user_id IS NULL
          AND currency = 'CREDITS'
          AND status = 'active'
        LIMIT 1
        FOR UPDATE;
    END IF;

    IF src_wallet.balance < req.amount THEN
        RAISE EXCEPTION 'Insufficient funds';
    END IF;

    UPDATE wallets
    SET balance = balance - req.amount
    WHERE wallet_id = src_wallet.wallet_id
      AND status = 'active';

    UPDATE wallets
    SET balance = balance + req.amount
    WHERE wallet_id = dst_wallet.wallet_id
      AND status = 'active';

    INSERT INTO transactions (
        transaction_id,
        provider,
        provider_tx_id,
        initiator_user_id,
        source_wallet_id,
        destination_wallet_id,
        amount,
        currency,
        transaction_type,
        direction,
        status,
        description
    ) VALUES (
        uuid_generate_v4(),
        NULL,
        NULL,
        p_student_user_id,
        src_wallet.wallet_id,
        dst_wallet.wallet_id,
        req.amount,
        'CREDITS',
        'MERCHANT',
        'outgoing',
        'SUCCESS',
        COALESCE(req.description, 'Paiement demande')
    );

    UPDATE payment_requests
    SET status = 'PAID',
        updated_at = NOW()
    WHERE request_id = p_request_id;

    SELECT * INTO result_req
    FROM payment_requests
    WHERE request_id = p_request_id;

    RETURN result_req;
EXCEPTION
    WHEN others THEN
        -- Keep request in a consistent state: do not mark PAID if it failed.
        RAISE;
END;
$$;

-- Atomically fulfill a Stripe checkout session exactly once.
CREATE OR REPLACE FUNCTION rpc_fulfill_stripe_checkout_atomic(
    p_stripe_session_id TEXT,
    p_user_id UUID,
    p_bde_group_id UUID,
    p_credits_amount DECIMAL(20, 8),
    p_amount_eur DECIMAL(20, 8)
)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
    already_processed stripe_checkout_processed_sessions%ROWTYPE;
    student_wallet wallets%ROWTYPE;
    bde_eur_wallet wallets%ROWTYPE;
BEGIN
    INSERT INTO stripe_checkout_processed_sessions(
        stripe_session_id,
        user_id,
        bde_group_id,
        credits_amount,
        amount_eur
    ) VALUES (
        p_stripe_session_id,
        p_user_id,
        p_bde_group_id,
        p_credits_amount,
        p_amount_eur
    )
    ON CONFLICT (stripe_session_id) DO NOTHING
    RETURNING * INTO already_processed;

    -- If RETURNING got no row, it's already processed.
    IF already_processed.stripe_session_id IS NOT NULL THEN
        -- Ensure student CREDITS wallet exists.
        SELECT * INTO student_wallet
        FROM wallets
        WHERE user_id = p_user_id
          AND currency = 'CREDITS'
          AND status = 'active'
        LIMIT 1
        FOR UPDATE;

        IF student_wallet.wallet_id IS NULL THEN
            INSERT INTO wallets (user_id, group_id, currency, balance, status)
            VALUES (p_user_id, p_bde_group_id, 'CREDITS', 0.00000000, 'active');

            SELECT * INTO student_wallet
            FROM wallets
            WHERE user_id = p_user_id
              AND currency = 'CREDITS'
              AND status = 'active'
            LIMIT 1
            FOR UPDATE;
        END IF;

        -- Ensure BDE EUR wallet exists (group wallet: user_id IS NULL).
        SELECT * INTO bde_eur_wallet
        FROM wallets
        WHERE group_id = p_bde_group_id
          AND user_id IS NULL
          AND currency = 'EUR'
          AND status = 'active'
        LIMIT 1
        FOR UPDATE;

        IF bde_eur_wallet.wallet_id IS NULL THEN
            INSERT INTO wallets (group_id, user_id, currency, balance, status)
            VALUES (p_bde_group_id, NULL, 'EUR', 0.00000000, 'active');

            SELECT * INTO bde_eur_wallet
            FROM wallets
            WHERE group_id = p_bde_group_id
              AND user_id IS NULL
              AND currency = 'EUR'
              AND status = 'active'
            LIMIT 1
            FOR UPDATE;
        END IF;

        -- Credit wallets.
        UPDATE wallets
        SET balance = balance + p_credits_amount
        WHERE wallet_id = student_wallet.wallet_id
          AND status = 'active';

        UPDATE wallets
        SET balance = balance + p_amount_eur
        WHERE wallet_id = bde_eur_wallet.wallet_id
          AND status = 'active';

        -- Insert accounting rows.
        INSERT INTO transactions (
            transaction_id,
            provider,
            provider_tx_id,
            initiator_user_id,
            source_wallet_id,
            destination_wallet_id,
            amount,
            currency,
            transaction_type,
            direction,
            status,
            description
        ) VALUES (
            uuid_generate_v4(),
            'stripe',
            p_stripe_session_id || ':credits',
            p_user_id,
            NULL,
            student_wallet.wallet_id,
            p_credits_amount,
            'CREDITS',
            'CASHIN',
            'incoming',
            'SUCCESS',
            'Achat de credits (Stripe)'
        );

        INSERT INTO transactions (
            transaction_id,
            provider,
            provider_tx_id,
            initiator_user_id,
            source_wallet_id,
            destination_wallet_id,
            amount,
            currency,
            transaction_type,
            direction,
            status,
            description
        ) VALUES (
            uuid_generate_v4(),
            'stripe',
            p_stripe_session_id || ':eur',
            p_user_id,
            NULL,
            bde_eur_wallet.wallet_id,
            p_amount_eur,
            'EUR',
            'CASHIN',
            'incoming',
            'SUCCESS',
            'Vente credits (Stripe)'
        );

        RETURN 'processed';
    END IF;

    RETURN 'already_processed';
END;
$$;
