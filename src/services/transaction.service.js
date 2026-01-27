const { v4: uuidv4 } = require('uuid');
const { supabase } = require('../config/database');
const logger = require('../config/logger');
const walletService = require('./wallet.service');

class TransactionService {
    /**
     * Initiate a new transaction
     * @param {Object} params - Transaction parameters
     * @returns {Promise<Object>} Created transaction
     */
    async initiateTransaction(params) {
        const {
            initiatorUserId,
            sourceWalletId,
            destinationWalletId,
            amount,
            currency = 'EPIC',
            transactionType,
            description = '',
            country = null,
            city = null,
        } = params;

        try {
            // Validate amount
            if (amount <= 0) {
                throw new Error('Amount must be positive');
            }

            // Get both wallets
            const sourceWallet = await walletService.getWallet(sourceWalletId);
            const destWallet = await walletService.getWallet(destinationWalletId);

            // Validate inter-group transaction rules if different groups
            if (sourceWallet.group_id !== destWallet.group_id) {
                await this.validateInterGroupTransaction(
                    sourceWallet.group_id,
                    destWallet.group_id,
                    amount
                );
            }

            // Check source wallet balance
            const balance = await walletService.getBalance(sourceWalletId);
            if (balance.availableBalance < amount) {
                throw new Error('Insufficient funds');
            }

            const transactionId = uuidv4();
            const direction = 'outgoing';

            const { data, error } = await supabase
                .from('transactions')
                .insert({
                    transaction_id: transactionId,
                    initiator_user_id: initiatorUserId,
                    source_wallet_id: sourceWalletId,
                    destination_wallet_id: destinationWalletId,
                    amount,
                    currency,
                    transaction_type: transactionType,
                    direction,
                    status: 'PENDING',
                    description,
                    country,
                    city
                })
                .select()
                .single();

            if (error) throw error;

            logger.info('Transaction initiated', {
                transactionId,
                amount,
                sourceWalletId,
                destinationWalletId,
            });

            // Process transaction asynchronously
            this.processTransaction(transactionId).catch((error) => {
                logger.error('Transaction processing failed', {
                    transactionId,
                    error: error.message,
                });
            });

            return data;
        } catch (error) {
            logger.error('Error initiating transaction', { error: error.message, params });
            throw error;
        }
    }

    /**
     * Process a pending transaction
     * NOTE: This should ideally be an RPC function for atomicity
     * @param {string} transactionId - Transaction ID
     * @returns {Promise<Object>} Processed transaction
     */
    async processTransaction(transactionId) {
        try {
            // Get transaction details
            const { data: transaction, error: txError } = await supabase
                .from('transactions')
                .select('*')
                .eq('transaction_id', transactionId)
                .single();

            if (txError || !transaction) {
                throw new Error('Transaction not found');
            }

            if (transaction.status !== 'PENDING') {
                throw new Error('Transaction already processed');
            }

            // Debit source wallet
            await walletService.updateBalance(
                null, // No client in Supabase
                transaction.source_wallet_id,
                -transaction.amount
            );

            // Credit destination wallet
            await walletService.updateBalance(
                null,
                transaction.destination_wallet_id,
                transaction.amount
            );

            // Update transaction status
            const { data: updatedTx, error: updateError } = await supabase
                .from('transactions')
                .update({
                    status: 'SUCCESS',
                    executed_at: new Date().toISOString()
                })
                .eq('transaction_id', transactionId)
                .select()
                .single();

            if (updateError) throw updateError;

            logger.info('Transaction processed successfully', { transactionId });

            // Update trust scores if inter-group
            const sourceWallet = await walletService.getWallet(transaction.source_wallet_id);
            const destWallet = await walletService.getWallet(transaction.destination_wallet_id);

            if (sourceWallet.group_id !== destWallet.group_id) {
                await this.updateTrustScore(
                    null,
                    sourceWallet.group_id,
                    destWallet.group_id,
                    transaction.amount,
                    true
                );
            }

            return updatedTx;
        } catch (error) {
            // Update transaction as failed
            await supabase
                .from('transactions')
                .update({
                    status: 'FAILED',
                    reason_code: error.message,
                    executed_at: new Date().toISOString()
                })
                .eq('transaction_id', transactionId);

            logger.error('Transaction processing failed', {
                transactionId,
                error: error.message,
            });

            throw error;
        }
    }

    /**
     * Validate inter-group transaction
     * @param {string} fromGroupId - Source group ID
     * @param {string} toGroupId - Destination group ID
     * @param {number} amount - Transaction amount
     */
    async validateInterGroupTransaction(fromGroupId, toGroupId, amount) {
        try {
            // Check exchange rules
            const { data: rules } = await supabase
                .from('exchange_rules')
                .select('*')
                .eq('from_group_id', fromGroupId)
                .eq('to_group_id', toGroupId)
                .eq('active', true);

            if (rules && rules.length > 0) {
                const rule = rules[0];

                // Check max transaction amount
                if (rule.max_transaction_amount && amount > parseFloat(rule.max_transaction_amount)) {
                    throw new Error(`Transaction exceeds maximum allowed amount: ${rule.max_transaction_amount}`);
                }

                // Check daily limit (simplified - should use RPC for accurate calculation)
                if (rule.daily_limit) {
                    const oneDayAgo = new Date();
                    oneDayAgo.setHours(oneDayAgo.getHours() - 24);

                    const { data: recentTx } = await supabase
                        .from('transactions')
                        .select('amount')
                        .gte('created_at', oneDayAgo.toISOString())
                        .eq('status', 'SUCCESS');

                    const dailyTotal = (recentTx || []).reduce((sum, tx) => sum + parseFloat(tx.amount), 0);

                    if (dailyTotal + amount > parseFloat(rule.daily_limit)) {
                        throw new Error('Daily transaction limit exceeded');
                    }
                }
            }

            // Check trust score
            const { data: trustResult } = await supabase
                .from('group_trust_scores')
                .select('trust_score')
                .eq('from_group_id', fromGroupId)
                .eq('to_group_id', toGroupId)
                .single();

            if (trustResult) {
                const trustScore = parseFloat(trustResult.trust_score);
                const minTrustScore = parseFloat(process.env.MIN_TRUST_SCORE_FOR_TRANSACTION || '20.00');

                if (trustScore < minTrustScore) {
                    throw new Error(`Insufficient trust score: ${trustScore}/100 (minimum: ${minTrustScore})`);
                }
            }
        } catch (error) {
            logger.error('Inter-group validation failed', {
                error: error.message,
                fromGroupId,
                toGroupId,
            });
            throw error;
        }
    }

    /**
     * Update trust score between groups after transaction
     * NOTE: This should be an RPC function for proper UPSERT logic
     * @param {Object} client - Not used with Supabase
     * @param {string} fromGroupId - Source group ID
     * @param {string} toGroupId - Destination group ID
     * @param {number} amount - Transaction amount
     * @param {boolean} success - Whether transaction was successful
     */
    async updateTrustScore(client, fromGroupId, toGroupId, amount, success) {
        try {
            // Check if trust score exists
            const { data: existing } = await supabase
                .from('group_trust_scores')
                .select('*')
                .eq('from_group_id', fromGroupId)
                .eq('to_group_id', toGroupId)
                .single();

            if (existing) {
                // Update existing
                const newTotalTx = existing.total_transactions + 1;
                const newSuccessful = existing.successful_transactions + (success ? 1 : 0);
                const newFailed = existing.failed_transactions + (success ? 0 : 1);
                const newVolume = parseFloat(existing.total_volume) + amount;
                const newTrustScore = Math.min(100, Math.max(0, 50 + (newSuccessful / newTotalTx * 50)));

                await supabase
                    .from('group_trust_scores')
                    .update({
                        total_transactions: newTotalTx,
                        total_volume: newVolume,
                        successful_transactions: newSuccessful,
                        failed_transactions: newFailed,
                        trust_score: newTrustScore,
                        last_updated: new Date().toISOString()
                    })
                    .eq('from_group_id', fromGroupId)
                    .eq('to_group_id', toGroupId);
            } else {
                // Insert new
                await supabase
                    .from('group_trust_scores')
                    .insert({
                        trust_id: uuidv4(),
                        from_group_id: fromGroupId,
                        to_group_id: toGroupId,
                        total_transactions: 1,
                        total_volume: amount,
                        successful_transactions: success ? 1 : 0,
                        failed_transactions: success ? 0 : 1,
                        trust_score: success ? 75 : 25
                    });
            }
        } catch (error) {
            logger.error('Error updating trust score', { error: error.message });
            // Non-critical, don't throw
        }
    }

    /**
     * Get transaction by ID
     * @param {string} transactionId - Transaction ID
     * @returns {Promise<Object>} Transaction details
     */
    async getTransaction(transactionId) {
        try {
            const { data, error } = await supabase
                .from('transactions')
                .select('*')
                .eq('transaction_id', transactionId)
                .single();

            if (error || !data) {
                throw new Error('Transaction not found');
            }

            return data;
        } catch (error) {
            logger.error('Error fetching transaction', { error: error.message, transactionId });
            throw error;
        }
    }

    async cancelTransaction(transactionId) {
        try {
            const { data, error } = await supabase
                .from('transactions')
                .update({
                    status: 'CANCELED',
                    reason_code: 'USER_CANCELED'
                })
                .eq('transaction_id', transactionId)
                .eq('status', 'PENDING')
                .select()
                .single();

            if (error || !data) {
                throw new Error('Transaction not found or cannot be canceled');
            }

            logger.info('Transaction canceled', { transactionId });

            return data;
        } catch (error) {
            logger.error('Error canceling transaction', { error: error.message, transactionId });
            throw error;
        }
    }

    /**
     * Transfer credits from User to Group (BDE)
     * @param {string} userId - Sender User ID
     * @param {string} groupId - Recipient Group ID
     * @param {number} amount - Amount in CREDITS
     */
    async transferCredits(userId, groupId, amount) {
        try {
            // 1. Get Source Wallet (Student - CREDITS)
            const { data: userWallets } = await supabase
                .from('wallets')
                .select('*')
                .eq('user_id', userId)
                .eq('currency', 'CREDITS')
                .eq('status', 'active')
                .limit(1);

            if (!userWallets || userWallets.length === 0) {
                throw new Error('No active CREDITS wallet found for user');
            }
            const sourceWallet = userWallets[0];

            // 2. Get Destination Wallet (Group - CREDITS)
            let { data: groupWallets } = await supabase
                .from('wallets')
                .select('*')
                .eq('group_id', groupId)
                .eq('currency', 'CREDITS')
                .eq('status', 'active')
                .limit(1);

            let destWalletId;
            if (!groupWallets || groupWallets.length === 0) {
                // Create CREDITS wallet for Group if missing
                logger.info(`Creating CREDITS wallet for group ${groupId}`);
                const newWalletId = uuidv4();
                await supabase
                    .from('wallets')
                    .insert({
                        wallet_id: newWalletId,
                        group_id: groupId,
                        currency: 'CREDITS',
                        balance: 0.00000000,
                        status: 'active'
                    });
                destWalletId = newWalletId;
            } else {
                destWalletId = groupWallets[0].wallet_id;
            }

            // 3. Initiate Transaction
            return await this.initiateTransaction({
                initiatorUserId: userId,
                sourceWalletId: sourceWallet.wallet_id,
                destinationWalletId: destWalletId,
                amount: amount,
                currency: 'CREDITS',
                transactionType: 'PAYMENT',
                description: 'Paiement BDE'
            });

        } catch (error) {
            logger.error('Credit transfer failed', { error: error.message, userId, groupId });
            throw error;
        }
    }

    /**
     * Create a payment request (BDE requesting payment from student)
     */
    async createPaymentRequest(bdeGroupId, studentUserId, amount, description) {
        if (amount <= 0) throw new Error("Amount must be positive");

        const { data, error } = await supabase
            .from('payment_requests')
            .insert({
                bde_group_id: bdeGroupId,
                student_user_id: studentUserId,
                amount,
                description,
                status: 'PENDING'
            })
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    /**
     * Get pending payment requests for a student
     */
    async getStudentPaymentRequests(studentUserId) {
        // Step 1: Fetch pending requests
        const { data, error } = await supabase
            .from('payment_requests')
            .select('*')
            .eq('student_user_id', studentUserId)
            .eq('status', 'PENDING')
            .order('created_at', { ascending: false });

        if (error) throw error;
        if (!data || data.length === 0) return [];

        // Step 2: Fetch Group Names
        const groupIds = [...new Set(data.map(r => r.bde_group_id))];
        let groupMap = {};

        if (groupIds.length > 0) {
            const { data: groups } = await supabase
                .from('groups')
                .select('group_id, group_name')
                .in('group_id', groupIds);

            if (groups) {
                groupMap = groups.reduce((acc, g) => {
                    acc[g.group_id] = g.group_name;
                    return acc;
                }, {});
            }
        }

        // Step 3: Merge
        return data.map(pr => ({
            ...pr,
            group_name: groupMap[pr.bde_group_id] || 'Unknown BDE'
        }));
    }

    /**
     * Get payment requests made by BDE
     */
    async getBDEPaymentRequests(bdeGroupId) {
        // Step 1: Fetch requests
        const { data, error } = await supabase
            .from('payment_requests')
            .select('*')
            .eq('bde_group_id', bdeGroupId)
            .order('created_at', { ascending: false });

        if (error) throw error;
        if (!data || data.length === 0) return [];

        // Step 2: Fetch Student Details
        const userIds = [...new Set(data.map(r => r.student_user_id))];
        let userMap = {};

        if (userIds.length > 0) {
            const { data: users } = await supabase
                .from('users')
                .select('user_id, full_name, email')
                .in('user_id', userIds);

            if (users) {
                userMap = users.reduce((acc, u) => {
                    acc[u.user_id] = u;
                    return acc;
                }, {});
            }
        }

        // Step 3: Merge
        return data.map(pr => ({
            ...pr,
            full_name: userMap[pr.student_user_id]?.full_name || 'Unknown',
            email: userMap[pr.student_user_id]?.email || 'Unknown'
        }));
    }

    /**
     * Respond to payment request (Pay or Reject)
     * NOTE: This should be an RPC function for atomicity
     */
    async respondToPaymentRequest(requestId, studentUserId, action) {
        const { data: request, error: reqError } = await supabase
            .from('payment_requests')
            .select('*')
            .eq('request_id', requestId)
            .single();

        if (reqError || !request) throw new Error("Request not found");
        if (request.student_user_id !== studentUserId) throw new Error("Unauthorized");
        if (request.status !== 'PENDING') throw new Error("Request already processed");

        if (action === 'REJECT') {
            await supabase
                .from('payment_requests')
                .update({
                    status: 'REJECTED',
                    updated_at: new Date().toISOString()
                })
                .eq('request_id', requestId);
            return { status: 'REJECTED' };
        }

        if (action === 'PAY') {
            // Simplified - should use RPC for atomicity
            try {
                // Get Student Wallet (CREDITS)
                const { data: sWallet } = await supabase
                    .from('wallets')
                    .select('wallet_id')
                    .eq('user_id', studentUserId)
                    .eq('currency', 'CREDITS')
                    .limit(1)
                    .single();

                if (!sWallet) throw new Error("No CREDITS wallet found");
                const sourceWalletId = sWallet.wallet_id;

                // Get BDE Wallet (CREDITS) - MUST be the group wallet (user_id is null)
                const { data: bWallet } = await supabase
                    .from('wallets')
                    .select('wallet_id')
                    .eq('group_id', request.bde_group_id)
                    .is('user_id', null)
                    .eq('currency', 'CREDITS')
                    .limit(1)
                    .single();

                if (!bWallet) throw new Error(`BDE has no CREDITS wallet (Group: ${request.bde_group_id})`);
                const destWalletId = bWallet.wallet_id;

                // Check Balance
                const balanceRes = await walletService.getBalance(sourceWalletId);
                logger.info(`Processing Payment:`);
                logger.info(`- Request: ${requestId} (Amount: ${request.amount})`);
                logger.info(`- Source (Student): ${sourceWalletId} (Balance: ${balanceRes.availableBalance})`);
                logger.info(`- Dest (BDE): ${destWalletId} (Group: ${request.bde_group_id})`);

                if (balanceRes.availableBalance < parseFloat(request.amount)) {
                    throw new Error("Insufficient funds");
                }

                // Execute Transfer
                logger.info(`Executing transfer: Source=${sourceWalletId}, Dest=${destWalletId}, Amount=${request.amount}`);
                await walletService.updateBalance(null, sourceWalletId, -parseFloat(request.amount));
                await walletService.updateBalance(null, destWalletId, parseFloat(request.amount));

                // Log Transaction
                await supabase
                    .from('transactions')
                    .insert({
                        transaction_id: uuidv4(),
                        initiator_user_id: studentUserId,
                        source_wallet_id: sourceWalletId,
                        destination_wallet_id: destWalletId,
                        amount: request.amount,
                        currency: 'CREDITS',
                        transaction_type: 'PAYMENT',
                        direction: 'outgoing',
                        status: 'SUCCESS',
                        description: `Paiement demande: ${request.description}`
                    });

                // Update Request Status
                await supabase
                    .from('payment_requests')
                    .update({
                        status: 'PAID',
                        updated_at: new Date().toISOString()
                    })
                    .eq('request_id', requestId);

                return { status: 'PAID' };
            } catch (error) {
                logger.error('Payment request processing failed', error);
                throw error;
            }
        }
    }
}

module.exports = new TransactionService();
