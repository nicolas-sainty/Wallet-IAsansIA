const { v4: uuidv4 } = require('uuid');
const { supabase } = require('../config/database');
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

            const { data: group, error: groupError } = await supabase
                .from('groups')
                .insert({
                    group_id: groupId,
                    group_name: groupName,
                    admin_user_id: adminUserId,
                    settings: JSON.stringify(settings),
                    status: 'active'
                })
                .select()
                .single();

            if (groupError) {
                throw groupError;
            }

            // Create BDE Wallet (EUR)
            await supabase
                .from('wallets')
                .insert({
                    wallet_id: uuidv4(),
                    user_id: adminUserId,
                    group_id: groupId,
                    currency: 'EUR',
                    balance: 0.00000000,
                    status: 'active'
                });

            logger.info('Group created', { groupId, groupName, adminUserId });

            return group;
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
            const { data, error } = await supabase
                .from('groups')
                .select('*')
                .eq('group_id', groupId)
                .single();

            if (error || !data) {
                throw new Error('Group not found');
            }

            return data;
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
            // Get all active groups
            const { data: groups, error: groupsError } = await supabase
                .from('groups')
                .select('*')
                .eq('status', 'active')
                .order('created_at', { ascending: false });

            if (groupsError) {
                throw groupsError;
            }

            // For each group, count wallets
            const groupsWithCounts = await Promise.all(
                (groups || []).map(async (group) => {
                    const { count } = await supabase
                        .from('wallets')
                        .select('*', { count: 'exact', head: true })
                        .eq('group_id', group.group_id);

                    return {
                        ...group,
                        wallet_count: count || 0
                    };
                })
            );

            return groupsWithCounts;
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

            // Check if rule exists
            const { data: existing } = await supabase
                .from('exchange_rules')
                .select('rule_id')
                .eq('from_group_id', fromGroupId)
                .eq('to_group_id', toGroupId)
                .single();

            let result;
            if (existing) {
                // Update existing rule
                const { data, error } = await supabase
                    .from('exchange_rules')
                    .update({
                        max_transaction_amount: maxTransactionAmount,
                        daily_limit: dailyLimit,
                        requires_approval: requiresApproval,
                        commission_rate: commissionRate,
                        active,
                        updated_at: new Date().toISOString()
                    })
                    .eq('from_group_id', fromGroupId)
                    .eq('to_group_id', toGroupId)
                    .select()
                    .single();

                if (error) throw error;
                result = data;
            } else {
                // Insert new rule
                const { data, error } = await supabase
                    .from('exchange_rules')
                    .insert({
                        rule_id: ruleId,
                        from_group_id: fromGroupId,
                        to_group_id: toGroupId,
                        max_transaction_amount: maxTransactionAmount,
                        daily_limit: dailyLimit,
                        requires_approval: requiresApproval,
                        commission_rate: commissionRate,
                        active
                    })
                    .select()
                    .single();

                if (error) throw error;
                result = data;
            }

            logger.info('Exchange rules set', { fromGroupId, toGroupId, rules });

            return result;
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
            const { data, error } = await supabase
                .from('exchange_rules')
                .select('*')
                .eq('from_group_id', fromGroupId)
                .eq('to_group_id', toGroupId)
                .single();

            if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
                throw error;
            }

            return data || null;
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
            const { data, error } = await supabase
                .from('group_trust_scores')
                .select(`
                    *,
                    groups:to_group_id (group_name)
                `)
                .eq('from_group_id', groupId)
                .order('trust_score', { ascending: false });

            if (error) {
                throw error;
            }

            // Flatten the groups object
            return (data || []).map(score => ({
                ...score,
                partner_group_name: score.groups?.group_name || null
            }));
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
            // Try to get from view
            const { data, error } = await supabase
                .from('group_transaction_stats')
                .select('*')
                .eq('group_id', groupId)
                .single();

            if (error || !data) {
                // Return default stats
                return {
                    groupId,
                    totalWallets: 0,
                    totalTransactions: 0,
                    totalVolume: 0,
                    avgTransactionAmount: 0,
                };
            }

            return data;
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
            const { data: wallets, error } = await supabase
                .from('wallets')
                .select(`
                    *,
                    users:user_id (email, full_name)
                `)
                .eq('group_id', groupId)
                .eq('status', 'active')
                .order('created_at', { ascending: false });

            if (error) {
                throw error;
            }

            // For each wallet, count transactions
            const walletsWithCounts = await Promise.all(
                (wallets || []).map(async (wallet) => {
                    const { count } = await supabase
                        .from('transactions')
                        .select('*', { count: 'exact', head: true })
                        .or(`source_wallet_id.eq.${wallet.wallet_id},destination_wallet_id.eq.${wallet.wallet_id}`);

                    return {
                        ...wallet,
                        email: wallet.users?.email || null,
                        full_name: wallet.users?.full_name || null,
                        transaction_count: count || 0
                    };
                })
            );

            return walletsWithCounts;
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
        const { data: users, error: userError } = await supabase
            .from('users')
            .select('user_id')
            .eq('email', email);

        if (userError || !users || users.length === 0) {
            throw new Error("Student email not found");
        }

        const userId = users[0].user_id;

        // Update User
        await supabase
            .from('users')
            .update({ bde_id: bdeGroupId })
            .eq('user_id', userId);

        // Ensure User has a CREDITS wallet
        const { data: existingWallets } = await supabase
            .from('wallets')
            .select('*')
            .eq('user_id', userId)
            .eq('currency', 'CREDITS');

        if (!existingWallets || existingWallets.length === 0) {
            // Create CREDITS wallet
            const walletId = uuidv4();
            await supabase
                .from('wallets')
                .insert({
                    wallet_id: walletId,
                    user_id: userId,
                    group_id: bdeGroupId,
                    currency: 'CREDITS',
                    balance: 0.00,
                    status: 'active'
                });
        } else {
            // Update group_id of existing wallet
            await supabase
                .from('wallets')
                .update({ group_id: bdeGroupId })
                .eq('user_id', userId)
                .eq('currency', 'CREDITS');
        }

        return { userId, bdeGroupId };
    }
}

module.exports = new GroupService();
