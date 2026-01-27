const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const logger = require('../config/logger');

class GroupService {
    /**
     * Create a new group
     * @param {string} groupName - Name of the group
     * @param {string} adminUserId - User ID of the group admin
     * @param {Object} settings - Group settings
     * @returns {Promise<Object>} Created group
     */
    async createGroup(groupName, adminUserId, settings = {}) {
        try {
            const groupId = uuidv4();

            const query = `
        INSERT INTO groups (group_id, group_name, admin_user_id, settings, status)
        VALUES ($1, $2, $3, $4, 'active')
        RETURNING *
      `;

            const result = await db.query(query, [
                groupId,
                groupName,
                adminUserId,
                JSON.stringify(settings),
            ]);

            // Create BDE Wallet (EUR)
            await db.query(
                `INSERT INTO wallets (wallet_id, user_id, group_id, currency, balance, status)
                 VALUES ($1, $2, $3, 'EUR', 0.00000000, 'active')`,
                [uuidv4(), adminUserId, groupId]
            );

            logger.info('Group created', { groupId, groupName, adminUserId });

            return result.rows[0];
        } catch (error) {
            logger.error('Error creating group', { error: error.message, groupName });
            throw error;
        }
    }

    /**
     * Get group by ID
     * @param {string} groupId - Group ID
     * @returns {Promise<Object>} Group details
     */
    async getGroup(groupId) {
        try {
            const query = 'SELECT * FROM groups WHERE group_id = $1';
            const result = await db.query(query, [groupId]);

            if (result.rows.length === 0) {
                throw new Error('Group not found');
            }

            return result.rows[0];
        } catch (error) {
            logger.error('Error fetching group', { error: error.message, groupId });
            throw error;
        }
    }

    /**
     * Get all active groups
     * @returns {Promise<Array>} List of groups
     */
    async getAllGroups() {
        try {
            const query = `
        SELECT g.*, 
          (SELECT COUNT(*) FROM wallets w WHERE w.group_id = g.group_id) as wallet_count
        FROM groups g 
        WHERE status = 'active' 
        ORDER BY created_at DESC
      `;

            const result = await db.query(query);
            return result.rows;
        } catch (error) {
            logger.error('Error fetching groups', { error: error.message });
            throw error;
        }
    }

    /**
     * Set exchange rules between two groups
     * @param {string} fromGroupId - Source group ID
     * @param {string} toGroupId - Destination group ID
     * @param {Object} rules - Exchange rules
     * @returns {Promise<Object>} Created/updated rule
     */
    async setExchangeRules(fromGroupId, toGroupId, rules) {
        try {
            const {
                maxTransactionAmount = null,
                dailyLimit = null,
                requiresApproval = false,
                commissionRate = 0.0,
                active = true,
            } = rules;

            const ruleId = uuidv4();

            const query = `
        INSERT INTO exchange_rules (
          rule_id, from_group_id, to_group_id, max_transaction_amount,
          daily_limit, requires_approval, commission_rate, active
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (from_group_id, to_group_id)
        DO UPDATE SET
          max_transaction_amount = $4,
          daily_limit = $5,
          requires_approval = $6,
          commission_rate = $7,
          active = $8,
          updated_at = NOW()
        RETURNING *
      `;

            const result = await db.query(query, [
                ruleId,
                fromGroupId,
                toGroupId,
                maxTransactionAmount,
                dailyLimit,
                requiresApproval,
                commissionRate,
                active,
            ]);

            logger.info('Exchange rules set', { fromGroupId, toGroupId, rules });

            return result.rows[0];
        } catch (error) {
            logger.error('Error setting exchange rules', {
                error: error.message,
                fromGroupId,
                toGroupId,
            });
            throw error;
        }
    }

    /**
     * Get exchange rules between two groups
     * @param {string} fromGroupId - Source group ID
     * @param {string} toGroupId - Destination group ID
     * @returns {Promise<Object|null>} Exchange rules or null
     */
    async getExchangeRules(fromGroupId, toGroupId) {
        try {
            const query = `
        SELECT * FROM exchange_rules
        WHERE from_group_id = $1 AND to_group_id = $2
      `;

            const result = await db.query(query, [fromGroupId, toGroupId]);
            return result.rows.length > 0 ? result.rows[0] : null;
        } catch (error) {
            logger.error('Error fetching exchange rules', {
                error: error.message,
                fromGroupId,
                toGroupId,
            });
            throw error;
        }
    }

    /**
     * Get trust scores for a group
     * @param {string} groupId - Group ID
     * @returns {Promise<Array>} Trust scores with other groups
     */
    async getTrustScores(groupId) {
        try {
            const query = `
        SELECT 
          gts.*,
          g.group_name as partner_group_name
        FROM group_trust_scores gts
        JOIN groups g ON g.group_id = gts.to_group_id
        WHERE gts.from_group_id = $1
        ORDER BY gts.trust_score DESC
      `;

            const result = await db.query(query, [groupId]);
            return result.rows;
        } catch (error) {
            logger.error('Error fetching trust scores', { error: error.message, groupId });
            throw error;
        }
    }

    /**
     * Get group statistics
     * @param {string} groupId - Group ID
     * @returns {Promise<Object>} Group statistics
     */
    async getGroupStats(groupId) {
        try {
            const query = `
        SELECT * FROM group_transaction_stats
        WHERE group_id = $1
      `;

            const result = await db.query(query, [groupId]);

            if (result.rows.length === 0) {
                return {
                    groupId,
                    totalWallets: 0,
                    totalTransactions: 0,
                    totalVolume: 0,
                    avgTransactionAmount: 0,
                };
            }

            return result.rows[0];
        } catch (error) {
            logger.error('Error fetching group stats', { error: error.message, groupId });
            throw error;
        }
    }

    /**
     * Get members of a group
     * @param {string} groupId - Group ID
     * @returns {Promise<Array>} List of wallets (members)
     */
    async getGroupMembers(groupId) {
        try {
            const query = `
        SELECT 
          w.*,
          u.email,
          u.full_name,
          (SELECT COUNT(*) FROM transactions 
           WHERE source_wallet_id = w.wallet_id OR destination_wallet_id = w.wallet_id) as transaction_count
        FROM wallets w
        JOIN users u ON w.user_id = u.user_id
        WHERE w.group_id = $1 AND w.status = 'active'
        ORDER BY w.created_at DESC
      `;

            const result = await db.query(query, [groupId]);
            return result.rows;
        } catch (error) {
            logger.error('Error fetching group members', { error: error.message, groupId });
            throw error;
        }
    }

    /**
     * Link a student to a BDE Group
     */
    async linkStudentToBDE(email, bdeGroupId) {
        // Find user by email
        const userRes = await db.query("SELECT user_id FROM users WHERE email = $1", [email]);
        if (userRes.rows.length === 0) {
            throw new Error("Student email not found");
        }
        const userId = userRes.rows[0].user_id;

        // Update User
        await db.query("UPDATE users SET bde_id = $1 WHERE user_id = $2", [bdeGroupId, userId]);

        // Ensure User has a CREDITS wallet (Student Wallet)
        // Check current wallets
        const wRes = await db.query("SELECT * FROM wallets WHERE user_id = $1 AND currency = 'CREDITS'", [userId]);
        if (wRes.rows.length === 0) {
            // Create CREDITS wallet
            const walletId = uuidv4();
            await db.query(
                `INSERT INTO wallets (wallet_id, user_id, group_id, currency, balance, status)
                 VALUES ($1, $2, $3, 'CREDITS', 0.00, 'active')`,
                [walletId, userId, bdeGroupId]
            );
        } else {
            // Update group_id of existing wallet if different?
            // Usually we might want to keep history, but for simplicity let's update group link
            await db.query("UPDATE wallets SET group_id = $1 WHERE user_id = $2 AND currency = 'CREDITS'", [bdeGroupId, userId]);
        }

        return { userId, bdeGroupId };
    }
}

module.exports = new GroupService();
