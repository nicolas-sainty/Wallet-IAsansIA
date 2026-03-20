/**
 * Use Case: Traiter une transaction (validation et mise à jour des soldes)
 */
class ProcessTransaction {
    constructor(walletRepository, transactionRepository, logger) {
        this.walletRepository = walletRepository;
        this.transactionRepository = transactionRepository;
        this.logger = logger;
    }

    async execute(transactionId) {
        const transaction = await this.transactionRepository.findById(transactionId);
        if (!transaction) throw new Error('Transaction introuvable');
        if (!transaction.isPending()) throw new Error('Transaction déjà traitée');

        const sourceWallet = await this.walletRepository.findById(transaction.sourceWalletId);
        const destWallet = await this.walletRepository.findById(transaction.destinationWalletId);

        if (!sourceWallet || !destWallet) {
            transaction.markAsFailed('Wallets introuvables');
            await this.transactionRepository.save(transaction);
            throw new Error('Wallets introuvables');
        }

        try {
            // Logique de débit/crédit (atomique au niveau domaine, mais persistence séparée ici)
            // Note: En production avec Supabase, on préférera toujours la RPC pour l'atomicité.
            // Ce Use Case illustre la logique métier découplée.
            
            sourceWallet.debit(transaction.amount);
            destWallet.credit(transaction.amount);

            // Sauvegarde des états
            await this.walletRepository.save(sourceWallet);
            await this.walletRepository.save(destWallet);
            
            transaction.markAsSuccess();
            const updatedTx = await this.transactionRepository.save(transaction);

            this.logger.info('Transaction réussie (Architecture Hexagonale)', { transactionId });
            return updatedTx;
        } catch (error) {
            transaction.markAsFailed(error.message);
            await this.transactionRepository.save(transaction);
            this.logger.error('Échec du traitement de la transaction', { transactionId, error: error.message });
            throw error;
        }
    }
}

module.exports = ProcessTransaction;
