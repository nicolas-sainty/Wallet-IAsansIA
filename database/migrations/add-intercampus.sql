-- ============================================================
--  Migration : Transferts inter-campus (alignement EpiPay)
--  Date: 2026-04-16
-- ============================================================

-- ─── Table des API keys inter-campus ──────────────────────────────────────────
-- Chaque BDE/campus possède une API key qui permet à ses partenaires
-- de s'authentifier lors d'un appel à /intercampus-receive.
-- La clé est stockée sous forme de hash SHA-256 (jamais en clair).

CREATE TABLE IF NOT EXISTS intercampus_api_keys (
    key_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_id       UUID REFERENCES wallets(wallet_id) ON DELETE CASCADE,
    campus_id       VARCHAR(128) NOT NULL,          -- ex: "groupe_2_BDX"
    hashed_key      VARCHAR(64)  NOT NULL UNIQUE,   -- SHA-256 hex de l'API key
    label           VARCHAR(255),                   -- libellé lisible (nom du partenaire)
    active          BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    last_used_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_intercampus_keys_hash
    ON intercampus_api_keys(hashed_key)
    WHERE active = TRUE;

CREATE INDEX IF NOT EXISTS idx_intercampus_keys_wallet
    ON intercampus_api_keys(wallet_id);

-- RLS : accès uniquement via service role (backend)
ALTER TABLE intercampus_api_keys ENABLE ROW LEVEL SECURITY;

-- ─── Table des transactions inter-campus (log enrichi) ────────────────────────
-- Les transactions inter-campus sont aussi enregistrées dans la table
-- principale `transactions` avec transaction_type = 'INTERCAMPUS'.
-- Cette table stocke les métadonnées spécifiques à l'échange inter-campus.

CREATE TABLE IF NOT EXISTS intercampus_transfers (
    transfer_id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    local_transaction_id    UUID REFERENCES transactions(transaction_id) ON DELETE SET NULL,
    remote_transaction_id   UUID,                  -- ID retourné par le campus distant
    direction               VARCHAR(16) NOT NULL CHECK (direction IN ('outgoing', 'incoming')),
    source_campus_id        VARCHAR(128),
    destination_campus_id   VARCHAR(128),
    destination_api_url     TEXT,                  -- URL appelée pour les outgoing
    amount                  NUMERIC(20, 8) NOT NULL,
    currency                VARCHAR(16) NOT NULL DEFAULT 'EPC',
    status                  VARCHAR(32) NOT NULL DEFAULT 'completed'
                            CHECK (status IN ('completed', 'failed', 'blocked', 'pending_review', 'refunded')),
    fraud_score             NUMERIC(5, 2),
    enriched_data           JSONB DEFAULT '{}'::jsonb,
    error_message           TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_intercampus_transfers_local_tx
    ON intercampus_transfers(local_transaction_id);

CREATE INDEX IF NOT EXISTS idx_intercampus_transfers_direction
    ON intercampus_transfers(direction, created_at DESC);

ALTER TABLE intercampus_transfers ENABLE ROW LEVEL SECURITY;

-- Commentaires
COMMENT ON TABLE intercampus_api_keys   IS 'API keys (hash SHA-256) pour authentifier les appels inter-campus entrants';
COMMENT ON TABLE intercampus_transfers  IS 'Log enrichi des transferts EpiCoins entre campus/BDE partenaires';
