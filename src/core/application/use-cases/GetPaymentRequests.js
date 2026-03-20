/**
 * Cas d'utilisation: Récupérer les demandes de paiement
 */
class GetPaymentRequests {
    constructor(transactionRepository) {
        this.transactionRepository = transactionRepository;
    }

    async execute({ userId, bdeId, role }) {
        if (role === 'student') {
            return this.transactionRepository.findRequestsByStudentId(userId);
        } else if (bdeId) {
            return this.transactionRepository.findRequestsByBDEId(bdeId);
        }
        return [];
    }
}

module.exports = GetPaymentRequests;
