const GetEvents = require('../../../../../../src/core/application/use-cases/GetEvents');

describe('GetEvents Use Case', () => {
    let mockEventRepo, getEvents;

    beforeEach(() => {
        mockEventRepo = {
            findAll: jest.fn().mockResolvedValue(['event1']),
            findUpcoming: jest.fn().mockResolvedValue(['event2'])
        };
        getEvents = new GetEvents(mockEventRepo);
    });

    it('should return upcoming events if no filters provided', async () => {
        const events = await getEvents.execute();
        expect(mockEventRepo.findUpcoming).toHaveBeenCalled();
        expect(events).toEqual(['event2']);
    });

    it('should return filtered events if filters are provided', async () => {
        const events = await getEvents.execute({ groupId: 'g1' });
        expect(mockEventRepo.findAll).toHaveBeenCalledWith({ groupId: 'g1' });
        expect(events).toEqual(['event1']);
    });
});
