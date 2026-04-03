const Event = require('../../../../../src/core/domain/entities/Event');

describe('Event Entity', () => {
    it('should create an Event instance with correct properties', () => {
        const eventData = {
            event_id: 'e1',
            group_id: 'g1',
            creator_user_id: 'u1',
            title: 'Test Event',
            description: 'Event desc',
            event_date: '2025-01-01',
            status: 'OPEN',
            reward_points: 100,
            max_participants: 50,
            created_at: '2024-01-01'
        };

        const event = new Event(eventData);

        expect(event.eventId).toBe('e1');
        expect(event.groupId).toBe('g1');
        expect(event.creatorUserId).toBe('u1');
        expect(event.title).toBe('Test Event');
        expect(event.description).toBe('Event desc');
        expect(event.eventDate).toBe('2025-01-01');
        expect(event.status).toBe('OPEN');
        expect(event.rewardPoints).toBe(100);
        expect(event.maxParticipants).toBe(50);
        expect(event.createdAt).toBe('2024-01-01');
    });

    it('should set default values when not provided', () => {
        const event = new Event({ event_id: 'e2' });
        expect(event.status).toBe('DRAFT');
        expect(event.rewardPoints).toBe(0);
    });

    it('isOpen() should return true when status is OPEN', () => {
        const event = new Event({ status: 'OPEN' });
        expect(event.isOpen()).toBe(true);
    });

    it('isOpen() should return false when status is not OPEN', () => {
        const event = new Event({ status: 'DRAFT' });
        expect(event.isOpen()).toBe(false);
    });

    it('isFull() should return true if maxParticipants is reached', () => {
        const event = new Event({ max_participants: 10 });
        expect(event.isFull(10)).toBe(true);
        expect(event.isFull(15)).toBe(true);
    });

    it('isFull() should return false if maxParticipants is not reached or not set', () => {
        const event = new Event({ max_participants: 10 });
        expect(event.isFull(5)).toBe(false);

        const unlimitedEvent = new Event({});
        expect(unlimitedEvent.isFull(100)).toBe(false); // undefined
    });
});
