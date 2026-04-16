'use strict';

const { v4: uuidv4 } = require('uuid');

/**
 * Repository Supabase pour les entités inter-campus :
 *  - intercampus_transfers
 *  - intercampus_api_keys
 */
class SupabaseIntercampusRepository {
    constructor(supabaseClient) {
        this.supabase = supabaseClient;
    }

    // ─── intercampus_transfers ────────────────────────────────────────────

    /**
     * Persiste un log de transfert inter-campus.
     */
    async save(data) {
        const row = {
            transfer_id:             uuidv4(),
            local_transaction_id:    data.localTransactionId    || null,
            remote_transaction_id:   data.remoteTransactionId   || null,
            direction:               data.direction,
            source_campus_id:        data.sourceCampusId        || null,
            destination_campus_id:   data.destinationCampusId   || null,
            destination_api_url:     data.destinationApiUrl     || null,
            amount:                  data.amount,
            currency:                data.currency              || 'EPC',
            status:                  data.status                || 'completed',
            fraud_score:             data.fraudScore            ?? null,
            enriched_data:           data.enrichedData          || {},
            error_message:           data.errorMessage          || null,
        };

        const { error } = await this.supabase
            .from('intercampus_transfers')
            .insert(row);

        if (error) {
            // Non-bloquant : on logue sans faire remonter
            console.error('[IntercampusRepository] Insert error:', error.message);
        }
    }

    /**
     * Vérifie si une transaction distante a déjà été traitée (idempotence).
     * @param {string} remoteTransactionId
     */
    async findByRemoteTransactionId(remoteTransactionId) {
        const { data, error } = await this.supabase
            .from('intercampus_transfers')
            .select('transfer_id, status')
            .eq('remote_transaction_id', remoteTransactionId)
            .maybeSingle();

        if (error) throw error;
        return data;
    }

    // ─── intercampus_api_keys ─────────────────────────────────────────────

    /**
     * Vérifie qu'un hash SHA-256 correspond à une clé active pour ce campus.
     * @param {string} hashedKey      - SHA-256 hex envoyé par le campus source
     * @param {string} sourceCampusId - ID déclaré du campus source
     * @returns {Promise<boolean>}
     */
    async verifyHashedKey(hashedKey, sourceCampusId) {
        if (!hashedKey || !sourceCampusId) return false;

        const { data, error } = await this.supabase
            .from('intercampus_api_keys')
            .select('key_id')
            .eq('hashed_key', hashedKey)
            .eq('campus_id', sourceCampusId)
            .eq('active', true)
            .maybeSingle();

        if (error) {
            console.error('[IntercampusRepository] verifyHashedKey error:', error.message);
            return false;
        }
        return !!data;
    }

    /**
     * Met à jour la date de dernière utilisation d'une clé.
     */
    async updateLastUsed(hashedKey, sourceCampusId) {
        await this.supabase
            .from('intercampus_api_keys')
            .update({ last_used_at: new Date().toISOString() })
            .eq('hashed_key', hashedKey)
            .eq('campus_id', sourceCampusId);
    }

    /**
     * Enregistre une nouvelle clé (hash SHA-256 uniquement, jamais la clé en clair).
     */
    async createApiKey({ walletId, campusId, hashedKey, label }) {
        const { data, error } = await this.supabase
            .from('intercampus_api_keys')
            .insert({
                wallet_id:   walletId   || null,
                campus_id:   campusId,
                hashed_key:  hashedKey,
                label:       label      || campusId,
                active:      true,
            })
            .select()
            .single();

        if (error) throw error;
        return data;
    }
}

module.exports = SupabaseIntercampusRepository;
