const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
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

            const query = `
        INSERT INTO wallets (wallet_id, user_id, group_id, currency, balance, status)
        VALUES ($1, $2, $3, $4, 0.00000000, 'active')
        RETURNING *
      `;

            const result = await db.query(query, [walletId, actualUserId, groupId, currency]);

            logger.info('Wallet created', {
                walletId,
                userId: actualUserId,
                groupId,
                currency
            });

            return result.rows[0];
        } catch (error) {
            logger.error('Error creating wallet', { error: error.message, groupId });
            throw new Error('Failed to create wallet');
        }
    }

    /**
     * Get wallet by ID with full details
     * @param {string} walletId - Wallet ID
     * @returns {Promise<Object>} Wallet details
     */
    async getWallet(walletId) {
        try {
            const query = `
        SELECT w.*, g.group_name 
        FROM wallets w
        LEFT JOIN groups g ON w.group_id = g.group_id
        WHERE w.wallet_id = $1
      `;

            const result = await db.query(query, [walletId]);

            if (result.rows.length === 0) {
                throw new Error('Wallet not found');
            }

            return result.rows[0];
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
            const query = `
        SELECT * FROM wallet_balances_with_pending 
        WHERE wallet_id = $1
      `;

            const result = await db.query(query, [walletId]);

            if (result.rows.length === 0) {
                throw new Error('Wallet not found');
            }

            return {
                walletId,
                confirmedBalance: parseFloat(result.rows[0].confirmed_balance),
                availableBalance: parseFloat(result.rows[0].available_balance),
            };
        } catch (error) {
            logger.error('Error fetching balance', { error: error.message, walletId });
            throw error;
        }
    }

    /**
     * Update wallet balance (internal use, typically called during transaction processing)
     * @param {Object} client - Database client (for transactions)
     * @param {string} walletId - Wallet ID
     * @param {number} amount - Amount to add (negative to subtract)
     * @returns {Promise<Object>} Updated wallet
     */
    async updateBalance(client, walletId, amount) {
        try {
            const query = `
        UPDATE wallets 
        SET balance = balance + $1, updated_at = NOW()
        WHERE wallet_id = $2 AND status = 'active'
        RETURNING *
      `;

            const result = await client.query(query, [amount, walletId]);

            if (result.rows.length === 0) {
                throw new Error('Wallet not found or inactive');
            }

            // Check if balance would go negative
            if (parseFloat(result.rows[0].balance) < 0) {
                throw new Error('Insufficient funds');
            }

            return result.rows[0];
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
            const query = `
        UPDATE wallets 
        SET status = 'suspended', updated_at = NOW()
        WHERE wallet_id = $1
        RETURNING *
      `;

            const result = await db.query(query, [walletId]);

            logger.warn('Wallet frozen', { walletId, reason });

            return result.rows[0];
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

            let query = `
        SELECT * FROM transactions
        WHERE (source_wallet_id = $1 OR destination_wallet_id = $1)
      `;

            const params = [walletId];

            if (status) {
                query += ` AND status = $${params.length + 1}`;
                params.push(status);
            }

            query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
            params.push(limit, offset);

            const result = await db.query(query, params);

            return result.rows;
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
            const query = `
        SELECT * FROM wallets
        WHERE group_id = $1 AND status = 'active'
        ORDER BY created_at DESC
      `;

            const result = await db.query(query, [groupId]);
            return result.rows;
        } catch (error) {
            logger.error('Error fetching group wallets', { error: error.message, groupId });
            throw error;
        }
    }
}

module.exports = new WalletService();
