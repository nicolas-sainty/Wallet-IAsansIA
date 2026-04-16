const { v4: uuidv4 } = require('uuid');

/**
 * Use Case: Initialiser une transaction
 * Si un use case d'analyse fraude est injecté, il est exécuté avant la création.
 * Transaction bloquée si le niveau de risque est HIGH ou CRITICAL.
 */
class InitiateTransaction {
    /**
     * @param {object} walletRepository
     * @param {object} transactionRepository
     * @param {object} logger
     * @param {object|null} [fraudAnalysisUseCase] - AnalyzeTransactionForFraud (optionnel)
     */
    constructor(walletRepository, transactionRepository, logger, fraudAnalysisUseCase = null) {
        this.walletRepository = walletRepository;
        this.transactionRepository = transactionRepository;
        this.logger = logger;
        this.fraudAnalysisUseCase = fraudAnalysisUseCase;
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

        // ── Analyse Anti-Fraude (si le module est activé) ─────────────────────
        if (this.fraudAnalysisUseCase) {
            const fraudResult = await this.fraudAnalysisUseCase.execute({
                initiatorUserId,
                sourceWalletId,
                destinationWalletId,
                amount,
                currency,
                transactionType,
                description,
            });

            if (fraudResult.blocked) {
                const blockingRules = fraudResult.alerts
                    .filter(a => a.isBlocking())
                    .map(a => a.rule)
                    .join(', ');

                const errorCode = fraudResult.amlFlag
                    ? 'FRAUD_AML_FLAGGED'
                    : 'FRAUD_TRANSACTION_BLOCKED';

                const err = new Error(
                    `Transaction bloquée par le module de détection de fraude. Règles déclenchées : ${blockingRules}`
                );
                err.code = errorCode;
                err.fraudAlerts = fraudResult.alerts.map(a => a.toJSON());
                throw err;
            }
        }
        // ─────────────────────────────────────────────────────────────────────

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
