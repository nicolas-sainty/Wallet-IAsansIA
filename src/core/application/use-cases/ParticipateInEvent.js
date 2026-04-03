/**
 * Use Case: Participer à un événement
 */
class ParticipateInEvent {
    constructor(eventRepository, walletRepository, logger) {
        this.eventRepository = eventRepository;
        this.walletRepository = walletRepository;
        this.logger = logger;
    }

    async execute(eventId, userId) {
        const event = await this.eventRepository.findById(eventId);
        if (!event) throw new Error('Événement introuvable');
        if (!event.isOpen()) throw new Error('L\'événement n\'est pas ouvert aux inscriptions');

        // Récupérer le wallet de points de l'utilisateur (CREDITS, EPIC ou PTS)
        const wallets = await this.walletRepository.findByUserId(userId);
        const creditWallet = wallets.find(w => ['CREDITS', 'EPIC', 'PTS'].includes(w.currency) && w.status === 'active');
        
        if (!creditWallet) {
            throw new Error('Aucun compte de points (EPIC/CREDITS) actif trouvé pour cet utilisateur');
        }

        // Vérifier si déjà inscrit
        const isAlreadyParticipating = await this.eventRepository.isParticipating(userId, eventId);
        if (isAlreadyParticipating) throw new Error('Déjà inscrit à cet événement');

        const participation = await this.eventRepository.addParticipant(eventId, creditWallet.walletId, event.rewardPoints);
        this.logger.info('Participation enregistrée (Architecture Hexagonale)', { eventId, userId });

        return participation;
    }
}

module.exports = ParticipateInEvent;
