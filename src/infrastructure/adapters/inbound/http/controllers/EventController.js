/**
 * Contrôleur Express pour les événements
 */
class EventController {
    constructor(getEventsUseCase, participateInEventUseCase, getParticipantsUseCase, getPendingParticipationsUseCase, validateParticipationUseCase, createEventUseCase) {
        this.getEventsUseCase = getEventsUseCase;
        this.participateInEventUseCase = participateInEventUseCase;
        this.getParticipantsUseCase = getParticipantsUseCase;
        this.getPendingParticipationsUseCase = getPendingParticipationsUseCase;
        this.validateParticipationUseCase = validateParticipationUseCase;
        this.createEventUseCase = createEventUseCase;
    }

    async getAll(req, res) {
        try {
            const { status } = req.query;
            // Un user ne doit voir que les events de son propre BDE (ou le groupId spécifié par précaution, bien qu'on enforce le sien)
            const groupId = req.query.groupId || req.user.bde_id;
            
            const events = await this.getEventsUseCase.execute({ groupId, status });
            
            // Map back to snake_case for frontend compatibility
            const data = events.map(e => ({
                event_id: e.eventId,
                group_id: e.groupId,
                creator_user_id: e.creatorUserId,
                title: e.title,
                description: e.description,
                event_date: e.eventDate,
                reward_points: e.rewardPoints,
                max_participants: e.maxParticipants,
                status: e.status,
                created_at: e.createdAt
            }));

            return res.json({ success: true, data });
        } catch (error) {
            return res.status(500).json({ success: false, error: error.message });
        }
    }

    async participate(req, res) {
        try {
            const { id: eventId } = req.params;
            const userId = req.user.user_id;
            const participation = await this.participateInEventUseCase.execute(eventId, userId);
            return res.json({ success: true, participation });
        } catch (error) {
            return res.status(400).json({ success: false, error: error.message });
        }
    }

    async getParticipants(req, res) {
        try {
            const { id: eventId } = req.params;
            const participants = await this.getParticipantsUseCase.execute(eventId);
            
            // Format for frontend
            const data = (participants || []).map(p => ({
                participant_id: p.participant_id,
                status: p.status,
                participated_at: p.participated_at,
                full_name: p.full_name,
                email: p.email,
                user_id: p.user_id
            }));

            return res.json({ success: true, data });
        } catch (error) {
            return res.status(500).json({ success: false, error: error.message });
        }
    }

    async getPending(req, res) {
        try {
            const { bde_id: bdeId } = req.user;
            const participations = await this.getPendingParticipationsUseCase.execute({ bdeId });
            return res.json({ success: true, data: participations });
        } catch (error) {
            return res.status(500).json({ success: false, error: error.message });
        }
    }

    async validate(req, res) {
        try {
            const { id: participantId } = req.params;
            const { status } = req.body;
            await this.validateParticipationUseCase.execute(participantId, status);
            return res.json({ success: true });
        } catch (error) {
            return res.status(400).json({ success: false, error: error.message });
        }
    }

    async create(req, res) {
        try {
            const { groupId, title, description, eventDate, rewardPoints, maxParticipants } = req.body;
            const creatorUserId = req.user.user_id;

            const event = await this.createEventUseCase.execute({
                groupId,
                title,
                description,
                eventDate,
                rewardPoints,
                maxParticipants,
                creatorUserId
            });

            return res.status(201).json({ success: true, data: event });
        } catch (error) {
            return res.status(400).json({ success: false, error: error.message });
        }
    }
}

module.exports = EventController;
