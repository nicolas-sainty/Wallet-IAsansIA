/**
 * Cas d'utilisation: Récupérer les participants d'un événement
 */
class GetParticipants {
    constructor(eventRepository) {
        this.eventRepository = eventRepository;
    }

    async execute(eventId) {
        return this.eventRepository.findParticipants(eventId);
    }
}

module.exports = GetParticipants;
