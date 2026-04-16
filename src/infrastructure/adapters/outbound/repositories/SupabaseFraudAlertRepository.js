const { v4: uuidv4 } = require('uuid');

/**
 * Implémentation Supabase du repository des alertes de fraude.
 * Persistance dans la table `fraud_alerts`.
 */
class SupabaseFraudAlertRepository {
    /**
     * @param {object} supabaseClient - Client Supabase injecté
     */
    constructor(supabaseClient) {
        this.supabase = supabaseClient;
    }

    /**
     * Persiste une liste d'alertes fraude.
     * @param {object[]} alertsData
     */
    async saveAll(alertsData) {
        if (!alertsData || alertsData.length === 0) return;

        const rows = alertsData.map(alert => ({
            alert_id:                 uuidv4(),
            rule:                     alert.rule,
            risk_level:               alert.riskLevel,
            message:                  alert.message,
            metadata:                 alert.metadata || {},
            initiator_user_id:        alert.initiator_user_id || null,
            source_wallet_id:         alert.source_wallet_id || null,
            destination_wallet_id:    alert.destination_wallet_id || null,
            amount:                   alert.amount || null,
            currency:                 alert.currency || null,
            transaction_type:         alert.transaction_type || null,
            is_blocking:              alert.is_blocking ?? false,
            is_aml_flagged:           alert.is_aml_flagged ?? false,
            detected_at:              alert.detectedAt || new Date().toISOString(),
            reviewed:                 false,
        }));

        const { error } = await this.supabase
            .from('fraud_alerts')
            .insert(rows);

        if (error) {
            // Non-bloquant : on logue sans faire remonter l'erreur
            console.error('[FraudAlertRepository] Insert error:', error.message);
        }
    }

    /**
     * Récupère les alertes par wallet source (pour audit).
     * @param {string} walletId
     * @param {{ limit?: number }} [options]
     * @returns {Promise<object[]>}
     */
    async findBySourceWalletId(walletId, options = {}) {
        const { limit = 50 } = options;
        const { data, error } = await this.supabase
            .from('fraud_alerts')
            .select('*')
            .eq('source_wallet_id', walletId)
            .order('detected_at', { ascending: false })
            .limit(limit);

        if (error) throw error;
        return data || [];
    }

    /**
     * Récupère les alertes AML critiques non encore révisées.
     * @param {{ since?: string }} [options]
     * @returns {Promise<object[]>}
     */
    async findAmlFlagged(options = {}) {
        const { since } = options;
        let query = this.supabase
            .from('fraud_alerts')
            .select('*')
            .eq('is_aml_flagged', true)
            .eq('reviewed', false)
            .order('detected_at', { ascending: false });

        if (since) {
            query = query.gte('detected_at', since);
        }

        const { data, error } = await query;
        if (error) throw error;
        return data || [];
    }
}

module.exports = SupabaseFraudAlertRepository;
