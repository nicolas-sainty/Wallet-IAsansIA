/**
 * Cas d'utilisation: Valider ou rejeter une participation
 */
class ValidateParticipation {
    constructor(eventRepository, walletRepository, transactionRepository, logger) {
        this.eventRepository = eventRepository;
        this.walletRepository = walletRepository;
        this.transactionRepository = transactionRepository;
        this.logger = logger;
    }

    async execute(participantId, status) {
        if (!['verified', 'rejected'].includes(status)) {
            throw new Error('Statut invalide');
        }

        const participation = await this.eventRepository.updateParticipationStatus(participantId, status);
        
        if (participation && status === 'verified') {
            try {
                // Créditer les points de récompense
                const wallet = await this.walletRepository.findById(participation.wallet_id);
                if (wallet) {
                    const amount = parseFloat(participation.points_earned) || 0;
                    if (amount > 0) {
                        wallet.credit(amount);
                        await this.walletRepository.save(wallet);

                        // Créer une trace de transaction
                        const { v4: uuidv4 } = require('uuid');
                        await this.transactionRepository.create({
                            transactionId: uuidv4(),
                            initiatorUserId: null, // Système
                            sourceWalletId: null, // Minting
                            destinationWalletId: participation.wallet_id,
                            amount: amount,
                            currency: 'CREDITS',
                            transactionType: 'REWARD',
                            direction: 'incoming',
                            status: 'SUCCESS',
                            description: `Récompense événement: ${participantId}`,
                            createdAt: new Date().toISOString(),
                            executedAt: new Date().toISOString()
                        });
                        
                        this.logger.info(`Récompense de ${amount} crédits attribuée au wallet ${participation.wallet_id}`);
                    }
                }
            } catch (error) {
                this.logger.error('Erreur lors de l\'attribution des récompenses d\'événement', { 
                    participantId, error: error.message 
                });
                // On ne bloque pas la validation de l'événement si le crédit échoue (sera géré par l'admin ou relance)
            }
        }

        return !!participation;
    }
}

module.exports = ValidateParticipation;
