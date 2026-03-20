/**
 * Cas d'utilisation: Récupérer l'historique des transactions d'un portefeuille
 */
class GetWalletTransactions {
    constructor(transactionRepository) {
        this.transactionRepository = transactionRepository;
    }

    async execute(walletId, options = {}) {
        return this.transactionRepository.findByWalletId(walletId, options);
    }
}

module.exports = GetWalletTransactions;
