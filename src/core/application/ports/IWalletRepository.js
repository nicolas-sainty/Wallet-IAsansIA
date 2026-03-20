/**
 * Interface pour le repository des wallets
 */
class IWalletRepository {
    async findById(walletId) { throw new Error('Method not implemented'); }
    async findByUserId(userId) { throw new Error('Method not implemented'); }
    async findByGroupId(groupId) { throw new Error('Method not implemented'); }
    async save(wallet) { throw new Error('Method not implemented'); }
    async create(walletData) { throw new Error('Method not implemented'); }
    async getBalanceWithPending(walletId) { throw new Error('Method not implemented'); }
}

module.exports = IWalletRepository;
