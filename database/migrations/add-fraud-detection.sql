-- ============================================================
--  Migration : Module de détection de fraude
--  Table: fraud_alerts
--  Date: 2026-04-16
-- ============================================================

-- Création de la table des alertes fraude
CREATE TABLE IF NOT EXISTS fraud_alerts (
    alert_id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Règle déclenchée (maps sur FRAUD_RULE dans FraudAlert.js)
    rule                    VARCHAR(64) NOT NULL,

    -- Niveau de risque : LOW | MEDIUM | HIGH | CRITICAL
    risk_level              VARCHAR(16) NOT NULL CHECK (risk_level IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),

    -- Message lisible
    message                 TEXT NOT NULL,

    -- Données contextuelles (montants, fréquences…)
    metadata                JSONB DEFAULT '{}'::jsonb,

    -- Contexte de la transaction analysée
    initiator_user_id       UUID REFERENCES users(user_id) ON DELETE SET NULL,
    source_wallet_id        UUID REFERENCES wallets(wallet_id) ON DELETE SET NULL,
    destination_wallet_id   UUID REFERENCES wallets(wallet_id) ON DELETE SET NULL,
    amount                  NUMERIC(20, 8),
    currency                VARCHAR(16),
    transaction_type        VARCHAR(32),

    -- Flags
    is_blocking             BOOLEAN DEFAULT FALSE,   -- La transaction a-t-elle été bloquée ?
    is_aml_flagged          BOOLEAN DEFAULT FALSE,   -- Doit-on signaler aux autorités (AML) ?
    reviewed                BOOLEAN DEFAULT FALSE,   -- A été examinée par un analyste

    -- Timestamps
    detected_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reviewed_at             TIMESTAMPTZ,
    reviewed_by             UUID REFERENCES users(user_id) ON DELETE SET NULL
);

-- Index pour les requêtes fréquentes
CREATE INDEX IF NOT EXISTS idx_fraud_alerts_source_wallet
    ON fraud_alerts(source_wallet_id, detected_at DESC);

CREATE INDEX IF NOT EXISTS idx_fraud_alerts_initiator
    ON fraud_alerts(initiator_user_id, detected_at DESC);

CREATE INDEX IF NOT EXISTS idx_fraud_alerts_aml
    ON fraud_alerts(is_aml_flagged, reviewed)
    WHERE is_aml_flagged = TRUE AND reviewed = FALSE;

CREATE INDEX IF NOT EXISTS idx_fraud_alerts_risk_level
    ON fraud_alerts(risk_level, detected_at DESC);

-- Row Level Security (même politique que les autres tables sensibles)
ALTER TABLE fraud_alerts ENABLE ROW LEVEL SECURITY;

-- Seuls les admins/BDE peuvent lire les alertes fraude
-- Les alertes sont insérées via le service backend (service role key)
CREATE POLICY "fraud_alerts_admin_read" ON fraud_alerts
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM users u
            WHERE u.user_id = auth.uid()
            AND u.role IN ('admin', 'bde_admin')
        )
    );

-- Commentaires de documentation
COMMENT ON TABLE fraud_alerts      IS 'Alertes générées par le module de détection de fraude et de blanchiment';
COMMENT ON COLUMN fraud_alerts.rule IS 'Code de la règle fraude déclenchée (ex: STRUCTURING, CIRCULAR_TRANSFER)';
COMMENT ON COLUMN fraud_alerts.risk_level IS 'Sévérité : LOW (info) | MEDIUM (surveillance) | HIGH (bloquant) | CRITICAL (AML)';
COMMENT ON COLUMN fraud_alerts.is_blocking IS 'TRUE si la transaction associée a été bloquée par cette alerte';
COMMENT ON COLUMN fraud_alerts.is_aml_flagged IS 'TRUE si la transaction doit être signalée dans le cadre de la lutte anti-blanchiment';
