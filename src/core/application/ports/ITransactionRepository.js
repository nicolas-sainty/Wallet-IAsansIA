/**
 * Interface pour le repository des transactions
 */
class ITransactionRepository {
    async findById(transactionId) { throw new Error('Method not implemented'); }
    async findByWalletId(walletId, options) { throw new Error('Method not implemented'); }
    async findBySourceWalletIdSince(walletId, since) { throw new Error('Method not implemented'); }
    async save(transaction) { throw new Error('Method not implemented'); }
    async create(transactionData) { throw new Error('Method not implemented'); }

    // Payment Requests
    async findRequestsByStudentId(studentId) { throw new Error('Method not implemented'); }
    async findRequestsByBDEId(bdeId) { throw new Error('Method not implemented'); }
    async findRequestById(requestId) { throw new Error('Method not implemented'); }
    async updateRequestStatus(requestId, status) { throw new Error('Method not implemented'); }
}

module.exports = ITransactionRepository;
