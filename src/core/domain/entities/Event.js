class Event {
    constructor({ event_id, group_id, creator_user_id, title, description, event_date, status, reward_points, max_participants, created_at }) {
        this.eventId = event_id;
        this.groupId = group_id;
        this.creatorUserId = creator_user_id;
        this.title = title;
        this.description = description;
        this.eventDate = event_date;
        this.status = status || 'DRAFT';
        this.rewardPoints = reward_points || 0;
        this.maxParticipants = max_participants;
        this.createdAt = created_at;
    }

    isOpen() {
        return this.status === 'OPEN';
    }

    isFull(currentParticipantsCount) {
        return this.maxParticipants && currentParticipantsCount >= this.maxParticipants;
    }
}

module.exports = Event;
