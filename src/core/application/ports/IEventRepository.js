/**
 * Interface pour le repository des événements
 */
class IEventRepository {
    async findAll(filters) { throw new Error('Not implemented'); }
    async findById(eventId) { throw new Error('Not implemented'); }
    async findUpcoming() { throw new Error('Not implemented'); }
    async create(eventData) { throw new Error('Not implemented'); }
    async save(event) { throw new Error('Not implemented'); }
    async delete(eventId) { throw new Error('Not implemented'); }
    
    // Participations
    async findParticipants(eventId) { throw new Error('Not implemented'); }
    async addParticipant(eventId, walletId) { throw new Error('Not implemented'); }
    async removeParticipant(eventId, walletId) { throw new Error('Not implemented'); }
    async isParticipating(userId, eventId) { throw new Error('Not implemented'); }
    async findPendingParticipations(filters) { throw new Error('Not implemented'); }
    async updateParticipationStatus(participantId, status) { throw new Error('Not implemented'); }
}

module.exports = IEventRepository;
