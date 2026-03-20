/**
 * Use Case: Récupérer les événements (prochains ou filtrés)
 */
class GetEvents {
    constructor(eventRepository) {
        this.eventRepository = eventRepository;
    }

    async execute(filters = {}) {
        if (Object.keys(filters).length > 0) {
            return this.eventRepository.findAll(filters);
        }
        return this.eventRepository.findUpcoming();
    }
}

module.exports = GetEvents;
