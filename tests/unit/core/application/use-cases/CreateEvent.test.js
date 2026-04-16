const CreateEvent = require('../../../../../src/core/application/use-cases/CreateEvent');

describe('CreateEvent Use Case', () => {
    let mockEventRepository;
    let mockLogger;
    let createEvent;

    beforeEach(() => {
        mockEventRepository = {
            create: jest.fn().mockResolvedValue({ eventId: 'generated-uuid', title: 'Test' })
        };
        mockLogger = {
            info: jest.fn(),
            error: jest.fn()
        };
        createEvent = new CreateEvent(mockEventRepository, mockLogger);
    });

    it('should create an event successfully with default reward points', async () => {
        const result = await createEvent.execute({
            groupId: 'g1',
            title: 'Test',
            maxParticipants: 50,
            creatorUserId: 'u1'
        });

        expect(mockEventRepository.create).toHaveBeenCalledWith(expect.objectContaining({
            groupId: 'g1',
            title: 'Test',
            maxParticipants: 50,
            creatorUserId: 'u1',
            rewardPoints: 0,
            status: 'OPEN'
        }));
        expect(mockLogger.info).toHaveBeenCalled();
        expect(result.eventId).toBe('generated-uuid');
    });

    it('should create an event with specified reward points', async () => {
        await createEvent.execute({ groupId: 'g1', rewardPoints: 100 });
        expect(mockEventRepository.create).toHaveBeenCalledWith(expect.objectContaining({
            rewardPoints: 100
        }));
    });
});
