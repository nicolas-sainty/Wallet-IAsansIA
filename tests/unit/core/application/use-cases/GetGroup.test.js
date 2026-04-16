const GetGroup = require('../../../../../src/core/application/use-cases/GetGroup');

describe('GetGroup Use Case', () => {
    let mockGroupRepo, getGroup;

    beforeEach(() => {
        mockGroupRepo = {
            findById: jest.fn().mockResolvedValue({ groupId: 'g1' })
        };
        getGroup = new GetGroup(mockGroupRepo);
    });

    it('should find group by ID', async () => {
        const result = await getGroup.execute('g1');
        expect(mockGroupRepo.findById).toHaveBeenCalledWith('g1');
        expect(result.groupId).toBe('g1');
    });
});
