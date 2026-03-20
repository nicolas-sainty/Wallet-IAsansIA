const { v4: uuidv4 } = require('uuid');

/**
 * Cas d'utilisation: Transférer des crédits d'un utilisateur à un groupe (BDE)
 */
class TransferCredits {
    constructor(walletRepository, transactionRepository, initiateTransactionUseCase, processTransactionUseCase, logger) {
        this.walletRepository = walletRepository;
        this.transactionRepository = transactionRepository;
        this.initiateTransactionUseCase = initiateTransactionUseCase;
        this.processTransactionUseCase = processTransactionUseCase;
        this.logger = logger;
    }

    async execute({ userId, groupId, amount }) {
        try {
            // 1. Trouver le wallet source (étudiant)
            const sourceWallets = await this.walletRepository.findByUserId(userId);
            const sourceWallet = sourceWallets.find(w => ['CREDITS', 'EPIC', 'PTS'].includes(w.currency) && w.status === 'active');
            
            if (!sourceWallet) {
                throw new Error('Aucun compte de points (EPIC/CREDITS) actif trouvé pour cet utilisateur');
            }

            // 2. Trouver le wallet destination (groupe BDE)
            const groupWallets = await this.walletRepository.findByGroupId(groupId);
            let destWallet = groupWallets.find(w => ['CREDITS', 'EPIC', 'PTS'].includes(w.currency) && w.status === 'active');
            
            if (!destWallet) {
                // Création automatique si manquant
                const currency = sourceWallet.currency || 'EPIC';
                this.logger.info(`Création d'un wallet ${currency} pour le groupe ${groupId}`);
                destWallet = await this.walletRepository.create({
                    walletId: uuidv4(),
                    groupId: groupId,
                    currency: currency,
                    balance: 0,
                    status: 'active'
                });
            }

            // 3. Initier la transaction
            const transaction = await this.initiateTransactionUseCase.execute({
                initiatorUserId: userId,
                sourceWalletId: sourceWallet.walletId,
                destinationWalletId: destWallet.walletId,
                amount: amount,
                currency: sourceWallet.currency,
                transactionType: 'MERCHANT',
                description: 'Paiement BDE'
            });

            // 4. Traiter la transaction
            return await this.processTransactionUseCase.execute(transaction.transactionId);

        } catch (error) {
            this.logger.error('TransferCredits failed', { error: error.message, userId, groupId });
            throw error;
        }
    }
}

module.exports = TransferCredits;
