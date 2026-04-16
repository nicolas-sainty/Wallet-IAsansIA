const GetGroups = require('../../../../../src/core/application/use-cases/GetGroups');

describe('GetGroups Use Case', () => {
    let mockGroupRepo, getGroups;

    beforeEach(() => {
        mockGroupRepo = {
            findAll: jest.fn().mockResolvedValue([{ groupId: 'g1' }])
        };
        getGroups = new GetGroups(mockGroupRepo);
    });

    it('should find all groups', async () => {
        const result = await getGroups.execute();
        expect(mockGroupRepo.findAll).toHaveBeenCalledWith({});
        expect(result).toHaveLength(1);
    });

    it('should pass filters', async () => {
        await getGroups.execute({ status: 'active' });
        expect(mockGroupRepo.findAll).toHaveBeenCalledWith({ status: 'active' });
    });
});
