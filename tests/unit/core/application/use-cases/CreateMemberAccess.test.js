const CreateMemberAccess = require('../../../../../src/core/application/use-cases/CreateMemberAccess');

describe('CreateMemberAccess Use Case', () => {
    let mockUserRepo, mockWalletRepo, mockHashProvider, mockLogger;
    let useCase;

    beforeEach(() => {
        mockUserRepo = {
            exists: jest.fn().mockResolvedValue(false),
            create: jest.fn().mockResolvedValue({ userId: 'u2', email: 'stu@test.com', bdeId: 'g1' })
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

        useCase = new CreateMemberAccess(mockUserRepo, mockWalletRepo, mockHashProvider, mockLogger);
    });

    it('should successfully create a member access', async () => {
        const req = { email: 'stu@test.com', fullName: 'Stu Den', password: 'pw', bdeId: 'g1' };
        const result = await useCase.execute(req);

        expect(mockUserRepo.exists).toHaveBeenCalledWith('stu@test.com');
        expect(mockUserRepo.create).toHaveBeenCalledWith(expect.objectContaining({ role: 'student', bdeId: 'g1', isVerified: true }));
        expect(mockWalletRepo.create).toHaveBeenCalled();
        expect(result.message).toBe('Accès étudiant créé avec succès.');
    });

    it('should throw if missing info', async () => {
        await expect(useCase.execute({ email: 'stu@test.com' }))
            .rejects.toThrow('Informations manquantes pour la création du compte');
    });

    it('should throw if user already exists', async () => {
        mockUserRepo.exists.mockResolvedValue(true);
        await expect(useCase.execute({ email: 'stu@test.com', fullName: 'Stu Den', password: 'pw', bdeId: 'g1' }))
            .rejects.toThrow('Cet étudiant possède déjà un compte (email existant).');
    });

    it('should log wallet errors but not crash', async () => {
        mockWalletRepo.create.mockRejectedValue(new Error('fail'));
        const req = { email: 'stu@test.com', fullName: 'Stu Den', password: 'pw', bdeId: 'g1' };
        await useCase.execute(req);
        expect(mockLogger.error).toHaveBeenCalled();
    });
});
