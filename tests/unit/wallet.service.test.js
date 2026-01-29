const walletService = require('../../src/services/wallet.service');
const { supabase } = require('../../src/config/database');

// Mock dependencies
jest.mock('../../src/config/database', () => ({
    supabase: {
        from: jest.fn()
    }
}));

jest.mock('../../src/config/logger', () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()
}));

describe('WalletService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('createWallet', () => {
        it('should create a wallet successfully', async () => {
            const mockData = { wallet_id: '123', balance: 0, currency: 'EPIC' };

            // Setup chain
            const mockSingle = jest.fn().mockResolvedValue({ data: mockData, error: null });
            const mockSelect = jest.fn().mockReturnValue({ single: mockSingle });
            const mockInsert = jest.fn().mockReturnValue({ select: mockSelect });
            supabase.from.mockReturnValue({ insert: mockInsert });

            const result = await walletService.createWallet('user1', 'group1', 'EPIC');

            expect(supabase.from).toHaveBeenCalledWith('wallets');
            expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
                user_id: 'user1',
                group_id: 'group1',
                currency: 'EPIC',
                status: 'active'
            }));
            expect(result).toEqual(mockData);
        });

        it('should throw error if creation fails', async () => {
            // Setup chain
            const mockSingle = jest.fn().mockResolvedValue({ data: null, error: { message: 'DB Error' } });
            const mockSelect = jest.fn().mockReturnValue({ single: mockSingle });
            const mockInsert = jest.fn().mockReturnValue({ select: mockSelect });
            supabase.from.mockReturnValue({ insert: mockInsert });

            await expect(walletService.createWallet('user1', 'group1'))
                .rejects.toThrow('Failed to create wallet');
        });
    });

    describe('updateBalance', () => {
        it('should update balance successfully', async () => {
            const existingWallet = { wallet_id: '123', balance: 100, status: 'active' };

            // --- Mocks for FETCH (Select) ---
            // from().select().eq().single()
            const mockFetchSingle = jest.fn().mockResolvedValue({ data: existingWallet, error: null });
            const mockFetchEq = jest.fn().mockReturnValue({ single: mockFetchSingle });
            const mockSelect = jest.fn().mockReturnValue({ eq: mockFetchEq });

            // --- Mocks for UPDATE ---
            // from().update().eq().eq().select().single()
            const mockUpdateSingle = jest.fn().mockResolvedValue({ data: { ...existingWallet, balance: 150 }, error: null });
            const mockUpdateSelect = jest.fn().mockReturnValue({ single: mockUpdateSingle });
            const mockUpdateEq2 = jest.fn().mockReturnValue({ select: mockUpdateSelect }); // Second .eq returns obj with .select
            const mockUpdateEq1 = jest.fn().mockReturnValue({ eq: mockUpdateEq2 }); // First .eq returns obj with .eq
            const mockUpdate = jest.fn().mockReturnValue({ eq: mockUpdateEq1 });

            // supabase.from logic
            supabase.from.mockImplementation((table) => {
                if (table === 'wallets') {
                    return {
                        select: mockSelect,
                        update: mockUpdate
                    };
                }
                return {};
            });

            const result = await walletService.updateBalance(null, '123', 50);

            expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
                balance: 150
            }));
            expect(result.balance).toBe(150);
        });

        it('should throw if insufficient funds', async () => {
            const existingWallet = { wallet_id: '123', balance: 10, status: 'active' };

            // Mock get balance
            const mockFetchSingle = jest.fn().mockResolvedValue({ data: existingWallet, error: null });
            const mockFetchEq = jest.fn().mockReturnValue({ single: mockFetchSingle });
            const mockSelect = jest.fn().mockReturnValue({ eq: mockFetchEq });

            supabase.from.mockReturnValue({ select: mockSelect });

            await expect(walletService.updateBalance(null, '123', -20))
                .rejects.toThrow('Insufficient funds');
        });
    });
});
