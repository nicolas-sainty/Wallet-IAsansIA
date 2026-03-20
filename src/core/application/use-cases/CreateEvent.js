const { v4: uuidv4 } = require('uuid');

/**
 * Cas d'utilisation: Créer un événement
 */
class CreateEvent {
    constructor(eventRepository, logger) {
        this.eventRepository = eventRepository;
        this.logger = logger;
    }

    async execute({ groupId, title, description, eventDate, rewardPoints, maxParticipants, creatorUserId }) {
        const eventId = uuidv4();
        
        const event = await this.eventRepository.create({
            eventId,
            groupId,
            creatorUserId,
            title,
            description,
            eventDate,
            rewardPoints: rewardPoints || 0,
            maxParticipants,
            status: 'OPEN'
        });

        this.logger.info('Événement créé via Architecture Hexagonale', { eventId });
        return event;
    }
}

module.exports = CreateEvent;
