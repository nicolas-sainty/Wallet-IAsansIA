const Wallet = require('../../../../../src/core/domain/entities/Wallet');

describe('Wallet Entity', () => {
    it('should create a Wallet instance with correct properties', () => {
        const walletData = {
            wallet_id: 'w1',
            user_id: 'u1',
            group_id: 'g1',
            currency: 'USD',
            balance: '100.50',
            status: 'inactive',
            created_at: '2024-01-01',
            updated_at: '2024-01-02'
        };

        const wallet = new Wallet(walletData);

        expect(wallet.walletId).toBe('w1');
        expect(wallet.userId).toBe('u1');
        expect(wallet.groupId).toBe('g1');
        expect(wallet.currency).toBe('USD');
        expect(wallet.balance).toBe(100.50);
        expect(wallet.status).toBe('inactive');
        expect(wallet.createdAt).toBe('2024-01-01');
        expect(wallet.updatedAt).toBe('2024-01-02');
    });

    it('should fallback to default values when not provided', () => {
        const wallet = new Wallet({ balance: 'invalid' });
        expect(wallet.currency).toBe('EPIC');
        expect(wallet.balance).toBe(0);
        expect(wallet.status).toBe('active');
    });

    it('isActive() should return true when status is active', () => {
        const wallet = new Wallet({ status: 'active' });
        expect(wallet.isActive()).toBe(true);
    });

    it('isActive() should return false when status is not active', () => {
        const wallet = new Wallet({ status: 'inactive' });
        expect(wallet.isActive()).toBe(false);
    });

    it('canDebit() should return true when active and sufficient balance', () => {
        const wallet = new Wallet({ status: 'active', balance: '100' });
        expect(wallet.canDebit(100)).toBe(true);
        expect(wallet.canDebit(50)).toBe(true);
    });

    it('canDebit() should return false when inactive or insufficient balance', () => {
        const wallet1 = new Wallet({ status: 'inactive', balance: '100' });
        expect(wallet1.canDebit(50)).toBe(false);

        const wallet2 = new Wallet({ status: 'active', balance: '50' });
        expect(wallet2.canDebit(100)).toBe(false);
    });

    it('debit() should reduce balance if allowed', () => {
        const wallet = new Wallet({ status: 'active', balance: '100' });
        wallet.debit(30);
        expect(wallet.balance).toBe(70);
    });

    it('debit() should throw Error if not allowed', () => {
        const wallet = new Wallet({ status: 'active', balance: '50' });
        expect(() => wallet.debit(100)).toThrow('Solde insuffisant ou wallet inactif');
    });

    it('credit() should increase balance if active', () => {
        const wallet = new Wallet({ status: 'active', balance: '100' });
        wallet.credit(50);
        expect(wallet.balance).toBe(150);
    });

    it('credit() should throw Error if inactive', () => {
        const wallet = new Wallet({ status: 'inactive', balance: '100' });
        expect(() => wallet.credit(50)).toThrow('Impossible de créditer un wallet inactif');
    });
});
