/**
 * Use Case: Récupérer le solde d'un wallet
 */
class GetWalletBalance {
    constructor(walletRepository) {
        this.walletRepository = walletRepository;
    }

    async execute(walletId) {
        const balance = await this.walletRepository.getBalanceWithPending(walletId);
        return balance;
    }
}

module.exports = GetWalletBalance;
