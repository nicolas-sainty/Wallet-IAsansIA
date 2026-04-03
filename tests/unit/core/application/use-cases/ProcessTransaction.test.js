const ProcessTransaction = require('../../../../../../src/core/application/use-cases/ProcessTransaction');

describe('ProcessTransaction Use Case', () => {
    let mockWalletRepo, mockTxRepo, mockLogger, processTx;

    beforeEach(() => {
        mockWalletRepo = {
            findById: jest.fn(),
            save: jest.fn()
        };
        mockTxRepo = {
            findById: jest.fn(),
            save: jest.fn()
        };
        mockLogger = {
            info: jest.fn(),
            error: jest.fn()
        };
        processTx = new ProcessTransaction(mockWalletRepo, mockTxRepo, mockLogger);
    });

    it('should throw if transaction not found', async () => {
        mockTxRepo.findById.mockResolvedValue(null);
        await expect(processTx.execute('tx1')).rejects.toThrow('Transaction introuvable');
    });

    it('should throw if transaction is not pending', async () => {
        mockTxRepo.findById.mockResolvedValue({ isPending: () => false });
        await expect(processTx.execute('tx1')).rejects.toThrow('Transaction déjà traitée');
    });

    it('should mark failed if wallets are not found', async () => {
        const mockTx = {
            sourceWalletId: 'w1', destinationWalletId: 'w2',
            isPending: () => true,
            markAsFailed: jest.fn()
        };
        mockTxRepo.findById.mockResolvedValue(mockTx);
        mockWalletRepo.findById.mockResolvedValue(null);

        await expect(processTx.execute('tx1')).rejects.toThrow('Wallets introuvables');
        expect(mockTx.markAsFailed).toHaveBeenCalledWith('Wallets introuvables');
        expect(mockTxRepo.save).toHaveBeenCalledWith(mockTx);
    });

    it('should process transaction correctly and mark success', async () => {
        const mockTx = {
            sourceWalletId: 'w1', destinationWalletId: 'w2', amount: 50,
            isPending: () => true,
            markAsSuccess: jest.fn()
        };
        const mockSource = { debit: jest.fn() };
        const mockDest = { credit: jest.fn() };

        mockTxRepo.findById.mockResolvedValue(mockTx);
        mockTxRepo.save.mockResolvedValue({ ...mockTx, status: 'SUCCESS' });
        mockWalletRepo.findById.mockImplementation(id => id === 'w1' ? mockSource : mockDest);

        const result = await processTx.execute('tx1');
        
        expect(mockSource.debit).toHaveBeenCalledWith(50);
        expect(mockDest.credit).toHaveBeenCalledWith(50);
        expect(mockWalletRepo.save).toHaveBeenCalledTimes(2);
        expect(mockTx.markAsSuccess).toHaveBeenCalled();
        expect(result.status).toBe('SUCCESS');
        expect(mockLogger.info).toHaveBeenCalled();
    });

    it('should mark failed if processing throws an error', async () => {
        const mockTx = {
            sourceWalletId: 'w1', destinationWalletId: 'w2', amount: 50,
            isPending: () => true,
            markAsFailed: jest.fn()
        };
        const mockSource = { debit: jest.fn(() => { throw new Error('Debit failed'); }) };
        const mockDest = { credit: jest.fn() };

        mockTxRepo.findById.mockResolvedValue(mockTx);
        mockWalletRepo.findById.mockImplementation(id => id === 'w1' ? mockSource : mockDest);

        await expect(processTx.execute('tx1')).rejects.toThrow('Debit failed');
        expect(mockTx.markAsFailed).toHaveBeenCalledWith('Debit failed');
        expect(mockLogger.error).toHaveBeenCalled();
    });
});
