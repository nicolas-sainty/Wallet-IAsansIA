/**
 * Cas d'utilisation: Récupérer les portefeuilles filtrés
 */
class GetWallets {
    constructor(walletRepository) {
        this.walletRepository = walletRepository;
    }

    async execute({ userId, groupId }) {
        if (userId) {
            return this.walletRepository.findByUserId(userId);
        } else if (groupId) {
            return this.walletRepository.findByGroupId(groupId);
        }
        return [];
    }
}

module.exports = GetWallets;
