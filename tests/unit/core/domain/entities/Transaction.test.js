const Transaction = require('../../../../../src/core/domain/entities/Transaction');

describe('Transaction Entity', () => {
    it('should create a Transaction instance with correct properties', () => {
        const txData = {
            transaction_id: 'tx1',
            initiator_user_id: 'u1',
            source_wallet_id: 'w1',
            destination_wallet_id: 'w2',
            amount: '100.50',
            currency: 'EPIC',
            transaction_type: 'TRANSFER',
            direction: 'OUT',
            status: 'SUCCESS',
            description: 'Payment for service',
            reason_code: 'NONE',
            created_at: '2024-01-01T00:00:00Z',
            executed_at: '2024-01-01T00:01:00Z'
        };

        const tx = new Transaction(txData);

        expect(tx.transactionId).toBe('tx1');
        expect(tx.initiatorUserId).toBe('u1');
        expect(tx.sourceWalletId).toBe('w1');
        expect(tx.destinationWalletId).toBe('w2');
        expect(tx.amount).toBe(100.50);
        expect(tx.currency).toBe('EPIC');
        expect(tx.transactionType).toBe('TRANSFER');
        expect(tx.direction).toBe('OUT');
        expect(tx.status).toBe('SUCCESS');
        expect(tx.description).toBe('Payment for service');
        expect(tx.reasonCode).toBe('NONE');
        expect(tx.createdAt).toBe('2024-01-01T00:00:00Z');
        expect(tx.executedAt).toBe('2024-01-01T00:01:00Z');
    });

    it('should fallback to default status when not provided', () => {
        const tx = new Transaction({ amount: '50' });
        expect(tx.status).toBe('PENDING');
    });

    it('isPending() should return true when status is PENDING', () => {
        const tx = new Transaction({ status: 'PENDING' });
        expect(tx.isPending()).toBe(true);
    });

    it('isPending() should return false when status is not PENDING', () => {
        const tx = new Transaction({ status: 'SUCCESS' });
        expect(tx.isPending()).toBe(false);
    });

    it('markAsSuccess() should set status to SUCCESS and set executedAt', () => {
        const tx = new Transaction({ transaction_id: 'tx1' });
        tx.markAsSuccess();
        expect(tx.status).toBe('SUCCESS');
        expect(tx.executedAt).toBeDefined();
    });

    it('markAsFailed() should set status to FAILED, record reason, and set executedAt', () => {
        const tx = new Transaction({ transaction_id: 'tx1' });
        tx.markAsFailed('INSUFFICIENT_FUNDS');
        expect(tx.status).toBe('FAILED');
        expect(tx.reasonCode).toBe('INSUFFICIENT_FUNDS');
        expect(tx.executedAt).toBeDefined();
    });
});
