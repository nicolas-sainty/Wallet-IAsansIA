/**
 * Cas d'utilisation: Valider ou rejeter une participation
 */
class ValidateParticipation {
    constructor(eventRepository, walletRepository, logger) {
        this.eventRepository = eventRepository;
        this.walletRepository = walletRepository;
        this.logger = logger;
    }

    async execute(participantId, status) {
        if (!['verified', 'rejected'].includes(status)) {
            throw new Error('Statut invalide');
        }

        const success = await this.eventRepository.updateParticipationStatus(participantId, status);
        
        if (success && status === 'verified') {
            this.logger.info(`Participation ${participantId} validée. Crédits à attribuer (Optionnel)`);
            // TODO: Créditer les points de récompense ici si nécessaire
        }

        return success;
    }
}

module.exports = ValidateParticipation;
