const { v4: uuidv4 } = require('uuid');

/**
 * Use Case: Initialiser une transaction
 */
class InitiateTransaction {
    constructor(walletRepository, transactionRepository, logger) {
        this.walletRepository = walletRepository;
        this.transactionRepository = transactionRepository;
        this.logger = logger;
    }

    async execute(params) {
        const {
            initiatorUserId,
            sourceWalletId,
            destinationWalletId,
            amount,
            currency = 'EPIC',
            transactionType,
            description = '',
        } = params;

        if (amount <= 0) throw new Error('Le montant doit être positif');

        const sourceWallet = await this.walletRepository.findById(sourceWalletId);
        const destWallet = await this.walletRepository.findById(destinationWalletId);

        if (!sourceWallet) throw new Error('Wallet source introuvable');
        if (!destWallet) throw new Error('Wallet destination introuvable');

        // Vérification du solde disponible (incluant les transactions en attente)
        const balanceInfo = await this.walletRepository.getBalanceWithPending(sourceWalletId);
        if (balanceInfo.availableBalance < amount) {
            throw new Error('Fonds insuffisants');
        }

        const transactionId = uuidv4();
        const txData = {
            transactionId,
            initiatorUserId,
            sourceWalletId,
            destinationWalletId,
            amount,
            currency,
            transactionType,
            direction: 'outgoing',
            status: 'PENDING',
            description
        };

        const tx = await this.transactionRepository.create(txData);
        
        this.logger.info('Transaction initiée (Architecture Hexagonale)', { transactionId });
        
        return tx;
    }
}

module.exports = InitiateTransaction;
