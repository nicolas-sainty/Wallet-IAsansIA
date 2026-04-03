const TransferCredits = require('../../../../../../src/core/application/use-cases/TransferCredits');

describe('TransferCredits Use Case', () => {
    let mockWalletRepo, mockTxRepo, mockInitiateTx, mockProcessTx, mockLogger, transferCredits;

    beforeEach(() => {
        mockWalletRepo = {
            findByUserId: jest.fn(),
            findByGroupId: jest.fn(),
            create: jest.fn()
        };
        mockTxRepo = {};
        mockInitiateTx = { execute: jest.fn() };
        mockProcessTx = { execute: jest.fn() };
        mockLogger = { info: jest.fn(), error: jest.fn() };

        transferCredits = new TransferCredits(mockWalletRepo, mockTxRepo, mockInitiateTx, mockProcessTx, mockLogger);
    });

    it('should throw error if source wallet not found', async () => {
        mockWalletRepo.findByUserId.mockResolvedValue([]);
        await expect(transferCredits.execute({ userId: 'u1', groupId: 'g1', amount: 50 })).rejects.toThrow('Aucun compte de points (EPIC/CREDITS) actif trouvé');
        expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should create dest wallet if not found, initiate and process transaction', async () => {
        mockWalletRepo.findByUserId.mockResolvedValue([{ currency: 'EPIC', status: 'active', walletId: 'w1' }]);
        mockWalletRepo.findByGroupId.mockResolvedValue([]);
        mockWalletRepo.create.mockResolvedValue({ currency: 'EPIC', status: 'active', walletId: 'new-w2' });
        
        mockInitiateTx.execute.mockResolvedValue({ transactionId: 'tx1' });
        mockProcessTx.execute.mockResolvedValue({ status: 'SUCCESS' });

        const result = await transferCredits.execute({ userId: 'u1', groupId: 'g1', amount: 50 });

        expect(mockWalletRepo.create).toHaveBeenCalled();
        expect(mockInitiateTx.execute).toHaveBeenCalledWith(expect.objectContaining({
            initiatorUserId: 'u1', sourceWalletId: 'w1', destinationWalletId: 'new-w2', amount: 50
        }));
        expect(mockProcessTx.execute).toHaveBeenCalledWith('tx1');
        expect(result.status).toBe('SUCCESS');
    });

    it('should use existing dest wallet if found', async () => {
        mockWalletRepo.findByUserId.mockResolvedValue([{ currency: 'EPIC', status: 'active', walletId: 'w1' }]);
        mockWalletRepo.findByGroupId.mockResolvedValue([{ currency: 'EPIC', status: 'active', walletId: 'w2' }]);
        
        mockInitiateTx.execute.mockResolvedValue({ transactionId: 'tx1' });
        mockProcessTx.execute.mockResolvedValue({ status: 'SUCCESS' });

        await transferCredits.execute({ userId: 'u1', groupId: 'g1', amount: 50 });
        expect(mockWalletRepo.create).not.toHaveBeenCalled();
        expect(mockInitiateTx.execute).toHaveBeenCalledWith(expect.objectContaining({
            destinationWalletId: 'w2'
        }));
    });
});
