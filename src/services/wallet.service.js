const { v4: uuidv4 } = require('uuid');
const { supabase } = require('../config/database');
const logger = require('../config/logger');

class WalletService {
    /**
     * Create a new wallet for a user
     * @param {string} userId - User ID (optional for auto-generation)
     * @param {string} groupId - Group ID
     * @param {string} currency - Currency code (default: EPIC)
     * @returns {Promise<Object>} Created wallet
     */
    async createWallet(userId = null, groupId, currency = 'EPIC') {
        try {
            const walletId = uuidv4();
            const actualUserId = userId || uuidv4(); // Auto-generate if not provided

            const { data, error } = await supabase
                .from('wallets')
                .insert({
                    wallet_id: walletId,
                    user_id: actualUserId,
                    group_id: groupId,
                    currency,
                    balance: 0.00000000,
                    status: 'active'
                })
                .select()
                .single();

            if (error) {
                logger.error('Error creating wallet', { error: error.message, groupId });
                throw new Error('Failed to create wallet');
            }

            logger.info('Wallet created', {
                walletId,
                userId: actualUserId,
                groupId,
                currency
            });

            return data;
        } catch (error) {
            logger.error('Error creating wallet', { error: error.message, groupId });
            throw new Error('Failed to create wallet');
        }
    }

    /**
     * Get wallets with filters
     * @param {Object} filters - { userId, groupId }
     */
    async getWallets(filters = {}) {
        let query = supabase
            .from('wallets')
            .select(`
                *,
                groups:group_id (group_name)
            `);

        if (filters.userId) {
            query = query.eq('user_id', filters.userId);
        }
        if (filters.groupId) {
            query = query.eq('group_id', filters.groupId);
        }

        const { data, error } = await query;

        if (error) {
            logger.error('Error fetching wallets', { error: error.message, filters });
            return [];
        }

        // Flatten the groups object
        return (data || []).map(wallet => ({
            ...wallet,
            group_name: wallet.groups?.group_name || null
        }));
    }

    /**
     * Get all wallets for a specific user
     * @param {string} userId 
     */
    async getWalletsByUser(userId) {
        return this.getWallets({ userId });
    }

    /**
     * Get wallet by ID with full details
     * @param {string} walletId - Wallet ID
     * @returns {Promise<Object>} Wallet details
     */
    async getWallet(walletId) {
        try {
            const { data, error } = await supabase
                .from('wallets')
                .select(`
                    *,
                    groups:group_id (group_name)
                `)
                .eq('wallet_id', walletId)
                .single();

            if (error || !data) {
                throw new Error('Wallet not found');
            }

            // Flatten the groups object
            return {
                ...data,
                group_name: data.groups?.group_name || null
            };
        } catch (error) {
            logger.error('Error fetching wallet', { error: error.message, walletId });
            throw error;
        }
    }

    /**
     * Get wallet balance including pending transactions
     * @param {string} walletId - Wallet ID
     * @returns {Promise<Object>} Balance information
     */
    async getBalance(walletId) {
        try {
            // Try to use the view if it exists, otherwise fallback to simple wallet query
            const { data, error } = await supabase
                .from('wallet_balances_with_pending')
                .select('*')
                .eq('wallet_id', walletId)
                .single();

            if (error) {
                // Fallback: just get the wallet balance
                const { data: wallet, error: walletError } = await supabase
                    .from('wallets')
                    .select('balance')
                    .eq('wallet_id', walletId)
                    .single();

                if (walletError || !wallet) {
                    throw new Error('Wallet not found');
                }

                return {
                    walletId,
                    confirmedBalance: parseFloat(wallet.balance),
                    availableBalance: parseFloat(wallet.balance),
                };
            }

            return {
                walletId,
                confirmedBalance: parseFloat(data.confirmed_balance),
                availableBalance: parseFloat(data.available_balance),
            };
        } catch (error) {
            logger.error('Error fetching balance', { error: error.message, walletId });
            throw error;
        }
    }

    /**
     * Update wallet balance (internal use, typically called during transaction processing)
     * Note: Supabase doesn't support transactions via JS client, so this is a simple update
     * For atomic operations, you should use RPC functions
     * @param {Object} client - Not used with Supabase (kept for compatibility)
     * @param {string} walletId - Wallet ID
     * @param {number} amount - Amount to add (negative to subtract)
     * @returns {Promise<Object>} Updated wallet
     */
    async updateBalance(client, walletId, amount) {
        try {
            // First, get current balance
            const { data: wallet, error: fetchError } = await supabase
                .from('wallets')
                .select('balance, status')
                .eq('wallet_id', walletId)
                .single();

            if (fetchError || !wallet) {
                throw new Error('Wallet not found or inactive');
            }

            if (wallet.status !== 'active') {
                throw new Error('Wallet not found or inactive');
            }

            const newBalance = parseFloat(wallet.balance) + amount;

            // Check if balance would go negative
            if (newBalance < 0) {
                throw new Error('Insufficient funds');
            }

            // Update the balance
            const { data, error } = await supabase
                .from('wallets')
                .update({
                    balance: newBalance,
                    updated_at: new Date().toISOString()
                })
                .eq('wallet_id', walletId)
                .eq('status', 'active')
                .select()
                .single();

            if (error || !data) {
                throw new Error('Failed to update balance');
            }

            return data;
        } catch (error) {
            logger.error('Error updating balance', { error: error.message, walletId, amount });
            throw error;
        }
    }

    /**
     * Freeze/suspend a wallet
     * @param {string} walletId - Wallet ID
     * @param {string} reason - Reason for suspension
     * @returns {Promise<Object>} Updated wallet
     */
    async freezeWallet(walletId, reason) {
        try {
            const { data, error } = await supabase
                .from('wallets')
                .update({
                    status: 'suspended',
                    updated_at: new Date().toISOString()
                })
                .eq('wallet_id', walletId)
                .select()
                .single();

            if (error) {
                throw new Error('Failed to freeze wallet');
            }

            logger.warn('Wallet frozen', { walletId, reason });

            return data;
        } catch (error) {
            logger.error('Error freezing wallet', { error: error.message, walletId });
            throw error;
        }
    }

    /**
     * Get wallet transaction history
     * @param {string} walletId - Wallet ID
     * @param {Object} options - Query options (limit, offset, status)
     * @returns {Promise<Array>} Transactions
     */
    async getTransactionHistory(walletId, options = {}) {
        try {
            const { limit = 50, offset = 0, status = null } = options;

            let query = supabase
                .from('transactions')
                .select('*')
                .or(`source_wallet_id.eq.${walletId},destination_wallet_id.eq.${walletId}`)
                .order('created_at', { ascending: false })
                .range(offset, offset + limit - 1);

            if (status) {
                query = query.eq('status', status);
            }

            const { data, error } = await query;

            if (error) {
                throw error;
            }

            // Adjust amount sign based on flow direction relative to this wallet
            const history = (data || []).map(tx => {
                const isSource = tx.source_wallet_id === walletId;
                return {
                    ...tx,
                    amount: isSource ? -Math.abs(tx.amount) : Math.abs(tx.amount)
                };
            });

            return history;
        } catch (error) {
            logger.error('Error fetching transaction history', { error: error.message, walletId });
            throw error;
        }
    }

    /**
     * Get wallets by group
     * @param {string} groupId - Group ID
     * @returns {Promise<Array>} Wallets in the group
     */
    async getWalletsByGroup(groupId) {
        try {
            const { data, error } = await supabase
                .from('wallets')
                .select('*')
                .eq('group_id', groupId)
                .eq('status', 'active')
                .order('created_at', { ascending: false });

            if (error) {
                throw error;
            }

            return data || [];
        } catch (error) {
            logger.error('Error fetching group wallets', { error: error.message, groupId });
            throw error;
        }
    }

    /**
     * Get wallets by user ID
     * @param {string} userId - User ID
     * @returns {Promise<Array>} Wallets owned by user
     */
    async getUserWallets(userId) {
        try {
            const query = `
                SELECT w.*, g.group_name 
                FROM wallets w
                LEFT JOIN groups g ON w.group_id = g.group_id
                WHERE w.user_id = $1 AND w.status = 'active'
                ORDER BY w.created_at DESC
            `;

            const result = await db.query(query, [userId]);
            return result.rows;
        } catch (error) {
            logger.error('Error fetching user wallets', { error: error.message, userId });
            throw error;
        }
    }
}

module.exports = new WalletService();
