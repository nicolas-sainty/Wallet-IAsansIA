const Wallet = require('../../../../core/domain/entities/Wallet');

/**
 * Implémentation Supabase du repository des wallets
 */
class SupabaseWalletRepository {
    constructor(supabaseClient) {
        this.supabase = supabaseClient;
    }

    async findById(walletId) {
        const { data, error } = await this.supabase
            .from('wallets')
            .select('*')
            .eq('wallet_id', walletId)
            .single();

        if (error || !data) return null;
        return new Wallet(data);
    }

    async findByUserId(userId) {
        const { data, error } = await this.supabase
            .from('wallets')
            .select('*')
            .eq('user_id', userId);

        if (error) return [];
        return data.map(w => new Wallet(w));
    }

    async findByGroupId(groupId) {
        const { data, error } = await this.supabase
            .from('wallets')
            .select('*')
            .eq('group_id', groupId)
            .is('user_id', null);

        if (error) return [];
        return data.map(w => new Wallet(w));
    }

    async save(wallet) {
        const { data, error } = await this.supabase
            .from('wallets')
            .update({
                balance: wallet.balance,
                status: wallet.status,
                updated_at: new Date().toISOString()
            })
            .eq('wallet_id', wallet.walletId)
            .select()
            .single();

        if (error) throw error;
        return new Wallet(data);
    }

    async create(walletData) {
        const { data, error } = await this.supabase
            .from('wallets')
            .insert({
                wallet_id: walletData.walletId,
                user_id: walletData.userId,
                group_id: walletData.groupId,
                currency: walletData.currency,
                balance: walletData.balance,
                status: walletData.status
            })
            .select()
            .single();

        if (error) throw error;
        return new Wallet(data);
    }

    async getBalanceWithPending(walletId) {
        // Optionnel : utilise la vue SQL si disponible
        const { data, error } = await this.supabase
            .from('wallet_balances_with_pending')
            .select('*')
            .eq('wallet_id', walletId)
            .single();

        if (error) {
            const wallet = await this.findById(walletId);
            if (!wallet) throw new Error('Wallet non trouvé');
            return {
                confirmedBalance: wallet.balance,
                availableBalance: wallet.balance
            };
        }

        return {
            confirmedBalance: parseFloat(data.confirmed_balance),
            availableBalance: parseFloat(data.available_balance)
        };
    }
}

module.exports = SupabaseWalletRepository;
