/**
 * Cas d'utilisation: Récupérer les participations en attente
 */
class GetPendingParticipations {
    constructor(eventRepository) {
        this.eventRepository = eventRepository;
    }

    async execute({ bdeId }) {
        return this.eventRepository.findPendingParticipations({ bdeId });
    }
}

module.exports = GetPendingParticipations;
