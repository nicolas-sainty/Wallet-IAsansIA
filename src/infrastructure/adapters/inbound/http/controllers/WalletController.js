/**
 * Contrôleur Express pour les wallets (Architecture Hexagonale)
 */
class WalletController {
    constructor(getWalletBalanceUseCase, getWalletsUseCase, getWalletTransactionsUseCase) {
        this.getWalletBalanceUseCase = getWalletBalanceUseCase;
        this.getWalletsUseCase = getWalletsUseCase;
        this.getWalletTransactionsUseCase = getWalletTransactionsUseCase;
    }

    async getWallets(req, res) {
        try {
            const { userId, groupId } = req.query;
            const wallets = await this.getWalletsUseCase.execute({ userId, groupId });
            
            // Map back to snake_case for frontend compatibility
            const data = wallets.map(w => ({
                wallet_id: w.walletId,
                user_id: w.userId,
                group_id: w.groupId,
                currency: w.currency,
                balance: w.balance,
                status: w.status,
                created_at: w.createdAt
            }));

            return res.json({ success: true, data });
        } catch (error) {
            return res.status(500).json({ success: false, error: error.message });
        }
    }

    async getBalance(req, res) {
        try {
            const { walletId } = req.params;
            const balance = await this.getWalletBalanceUseCase.execute(walletId);
            return res.json({ 
                success: true, 
                data: {
                    confirmed_balance: balance.confirmedBalance,
                    available_balance: balance.availableBalance
                }
            });
        } catch (error) {
            return res.status(400).json({ success: false, error: error.message });
        }
    }

    async getTransactions(req, res) {
        try {
            const { walletId } = req.params;
            const { limit, offset } = req.query;
            const transactions = await this.getWalletTransactionsUseCase.execute(walletId, { 
                limit: parseInt(limit) || 50, 
                offset: parseInt(offset) || 0 
            });

            // Map back to snake_case for frontend compatibility
            const data = transactions.map(t => ({
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
            }));

            return res.json({ success: true, data });
        } catch (error) {
            return res.status(400).json({ success: false, error: error.message });
        }
    }
}

module.exports = WalletController;
