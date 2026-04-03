const RegisterBDE = require('../../../../../src/core/application/use-cases/RegisterBDE');

describe('RegisterBDE Use Case', () => {
    let mockUserRepo, mockGroupRepo, mockWalletRepo, mockHashProvider, mockLogger;
    let useCase;

    beforeEach(() => {
        mockUserRepo = {
            exists: jest.fn().mockResolvedValue(false),
            create: jest.fn().mockResolvedValue({ userId: 'u1', email: 'bde@test.com', bdeId: 'g1' })
        };
        mockGroupRepo = {
            create: jest.fn().mockResolvedValue({ groupId: 'g1' })
        };
        mockWalletRepo = {
            create: jest.fn().mockResolvedValue({})
        };
        mockHashProvider = {
            hash: jest.fn().mockResolvedValue('hashed_pwd')
        };
        mockLogger = {
            info: jest.fn(),
            error: jest.fn()
        };

        useCase = new RegisterBDE(mockUserRepo, mockGroupRepo, mockWalletRepo, mockHashProvider, mockLogger);
    });

    it('should successfully register a BDE', async () => {
        const req = { bdeName: 'My BDE', email: 'bde@test.com', password: '123', fullName: 'BDE Admin' };
        const result = await useCase.execute(req);

        expect(mockUserRepo.exists).toHaveBeenCalledWith('bde@test.com');
        expect(mockGroupRepo.create).toHaveBeenCalled();
        expect(mockUserRepo.create).toHaveBeenCalled();
        expect(mockWalletRepo.create).toHaveBeenCalledTimes(2); // EUR and CREDITS
        expect(result.message).toBe('Inscription du BDE réussie !');
    });

    it('should throw if missing parameters', async () => {
        await expect(useCase.execute({ bdeName: 'My BDE' })).rejects.toThrow('Champs manquants obligatoires');
    });

    it('should throw if email already used', async () => {
        mockUserRepo.exists.mockResolvedValue(true);
        await expect(useCase.execute({ bdeName: 'B', email: 'e', password: 'p', fullName: 'f' }))
            .rejects.toThrow('Cet email est déjà utilisé.');
    });

    it('should handle wallet creation errors gracefully', async () => {
        mockWalletRepo.create.mockRejectedValue(new Error('DB failure'));
        const req = { bdeName: 'My BDE', email: 'bde@test.com', password: '123', fullName: 'BDE Admin' };
        
        await useCase.execute(req);
        // It shouldn't crash
        expect(mockLogger.error).toHaveBeenCalled();
    });
});
