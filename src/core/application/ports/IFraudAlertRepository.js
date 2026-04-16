/**
 * Interface (port) pour le repository des alertes de fraude
 */
class IFraudAlertRepository {
    /**
     * Persiste une liste d'alertes fraude liées à une transaction.
     * @param {object[]} alertsData
     * @returns {Promise<void>}
     */
    async saveAll(alertsData) { throw new Error('Method not implemented'); }

    /**
     * Récupère toutes les alertes liées à un wallet source (pour audit).
     * @param {string} walletId
     * @param {{ limit?: number }} [options]
     * @returns {Promise<object[]>}
     */
    async findBySourceWalletId(walletId, options) { throw new Error('Method not implemented'); }

    /**
     * Récupère les alertes AML critiques (pour signalement réglementaire).
     * @param {{ since?: string }} [options]
     * @returns {Promise<object[]>}
     */
    async findAmlFlagged(options) { throw new Error('Method not implemented'); }
}

module.exports = IFraudAlertRepository;
