/**
 * Contrôleur Express pour les transactions initiées via API
 */
class TransactionController {
    constructor(initiateTransactionUseCase, processTransactionUseCase, transferCreditsUseCase) {
        this.initiateTransactionUseCase = initiateTransactionUseCase;
        this.processTransactionUseCase = processTransactionUseCase;
        this.transferCreditsUseCase = transferCreditsUseCase;
    }

    async initiate(req, res) {
        try {
            const { sourceWalletId, destinationWalletId, amount, currency, transactionType, description } = req.body;
            const initiatorUserId = req.user.user_id;

            const transaction = await this.initiateTransactionUseCase.execute({
                initiatorUserId,
                sourceWalletId,
                destinationWalletId,
                amount,
                currency,
                transactionType,
                description
            });

            return res.status(201).json({ success: true, data: this.toDTO(transaction) });
        } catch (error) {
            return res.status(400).json({ success: false, error: error.message });
        }
    }

    async process(req, res) {
        try {
            const { transactionId } = req.params;
            const transaction = await this.processTransactionUseCase.execute(transactionId);
            return res.json({ success: true, data: this.toDTO(transaction) });
        } catch (error) {
            return res.status(400).json({ success: false, error: error.message });
        }
    }

    async pay(req, res) {
        try {
            const { groupId, amount } = req.body;
            const userId = req.user.user_id;

            const transaction = await this.transferCreditsUseCase.execute({ userId, groupId, amount });
            return res.status(201).json({ success: true, data: this.toDTO(transaction) });
        } catch (error) {
            return res.status(400).json({ success: false, error: error.message });
        }
    }

    toDTO(t) {
        return {
            transaction_id: t.transactionId,
            initiator_user_id: t.initiatorUserId,
            source_wallet_id: t.sourceWalletId,
            destination_wallet_id: t.destinationWalletId,
            amount: t.amount,
            currency: t.currency,
            transaction_type: t.transactionType,
            direction: t.direction,
            status: t.status,
            description: t.description,
            created_at: t.createdAt,
            executed_at: t.executedAt
        };
    }
}

module.exports = TransactionController;
