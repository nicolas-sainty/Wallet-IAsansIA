const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
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
            const direction = 'outgoing'; // From initiator's perspective

            const query = `
        INSERT INTO transactions (
          transaction_id, initiator_user_id, source_wallet_id, destination_wallet_id,
          amount, currency, transaction_type, direction, status,
          description, country, city, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'PENDING', $9, $10, $11, NOW())
        RETURNING *
      `;

            const { rows } = await db.query(query, [
                transactionId,
                initiatorUserId,
                sourceWalletId,
                destinationWalletId,
                amount,
                currency,
                transactionType,
                direction,
                description,
                country,
                city,
            ]);

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

            return rows[0];
        } catch (error) {
            logger.error('Error initiating transaction', { error: error.message, params });
            throw error;
        }
    }

    /**
     * Process a pending transaction
     * @param {string} transactionId - Transaction ID
     * @returns {Promise<Object>} Processed transaction
     */
    async processTransaction(transactionId) {
        return await db.transaction(async (client) => {
            try {
                // Get transaction details
                const txQuery = 'SELECT * FROM transactions WHERE transaction_id = $1';
                const txResult = await client.query(txQuery, [transactionId]);

                if (txResult.rows.length === 0) {
                    throw new Error('Transaction not found');
                }

                const transaction = txResult.rows[0];

                if (transaction.status !== 'PENDING') {
                    throw new Error('Transaction already processed');
                }

                // Debit source wallet
                await walletService.updateBalance(
                    client,
                    transaction.source_wallet_id,
                    -transaction.amount
                );

                // Credit destination wallet
                await walletService.updateBalance(
                    client,
                    transaction.destination_wallet_id,
                    transaction.amount
                );

                // Update transaction status
                const updateQuery = `
          UPDATE transactions 
          SET status = 'SUCCESS', executed_at = NOW()
          WHERE transaction_id = $1
          RETURNING *
        `;

                const result = await client.query(updateQuery, [transactionId]);

                logger.info('Transaction processed successfully', { transactionId });

                // Update trust scores if inter-group
                const sourceWallet = await walletService.getWallet(transaction.source_wallet_id);
                const destWallet = await walletService.getWallet(transaction.destination_wallet_id);

                if (sourceWallet.group_id !== destWallet.group_id) {
                    await this.updateTrustScore(
                        client,
                        sourceWallet.group_id,
                        destWallet.group_id,
                        transaction.amount,
                        true
                    );
                }

                return result.rows[0];
            } catch (error) {
                // Update transaction as failed
                const failQuery = `
          UPDATE transactions 
          SET status = 'FAILED', reason_code = $1, executed_at = NOW()
          WHERE transaction_id = $2
          RETURNING *
        `;

                await client.query(failQuery, [error.message, transactionId]);

                logger.error('Transaction processing failed', {
                    transactionId,
                    error: error.message,
                });

                throw error;
            }
        });
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
            const rulesQuery = `
        SELECT * FROM exchange_rules
        WHERE from_group_id = $1 AND to_group_id = $2 AND active = true
      `;

            const { rows: rules } = await db.query(rulesQuery, [fromGroupId, toGroupId]);

            if (rules.length > 0) {
                const rule = rules[0];

                // Check max transaction amount
                if (rule.max_transaction_amount && amount > parseFloat(rule.max_transaction_amount)) {
                    throw new Error(`Transaction exceeds maximum allowed amount: ${rule.max_transaction_amount}`);
                }

                // Check daily limit
                if (rule.daily_limit) {
                    const dailyQuery = `
            SELECT COALESCE(SUM(amount), 0) as total
            FROM transactions
            WHERE source_wallet_id IN (SELECT wallet_id FROM wallets WHERE group_id = $1)
              AND destination_wallet_id IN (SELECT wallet_id FROM wallets WHERE group_id = $2)
              AND created_at >= NOW() - INTERVAL '24 hours'
              AND status = 'SUCCESS'
          `;

                    const { rows: dailyResult } = await db.query(dailyQuery, [fromGroupId, toGroupId]);
                    const dailyTotal = parseFloat(dailyResult[0].total);

                    if (dailyTotal + amount > parseFloat(rule.daily_limit)) {
                        throw new Error('Daily transaction limit exceeded');
                    }
                }
            }

            // Check trust score
            const trustQuery = `
        SELECT trust_score FROM group_trust_scores
        WHERE from_group_id = $1 AND to_group_id = $2
      `;

            const { rows: trustResult } = await db.query(trustQuery, [fromGroupId, toGroupId]);

            if (trustResult.length > 0) {
                const trustScore = parseFloat(trustResult[0].trust_score);
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
     * @param {Object} client - Database client
     * @param {string} fromGroupId - Source group ID
     * @param {string} toGroupId - Destination group ID
     * @param {number} amount - Transaction amount
     * @param {boolean} success - Whether transaction was successful
     */
    async updateTrustScore(client, fromGroupId, toGroupId, amount, success) {
        try {
            const query = `
        INSERT INTO group_trust_scores (
          trust_id, from_group_id, to_group_id, total_transactions, total_volume,
          successful_transactions, failed_transactions
        ) VALUES (
          $1, $2, $3, 1, $4, $5, $6
        )
        ON CONFLICT (from_group_id, to_group_id)
        DO UPDATE SET
          total_transactions = group_trust_scores.total_transactions + 1,
          total_volume = group_trust_scores.total_volume + $4,
          successful_transactions = group_trust_scores.successful_transactions + $5,
          failed_transactions = group_trust_scores.failed_transactions + $6,
          trust_score = LEAST(100, GREATEST(0, 
            50 + (EXCLUDED.successful_transactions::float / NULLIF(EXCLUDED.total_transactions, 0) * 50)
          )),
          last_updated = NOW()
      `;

            await client.query(query, [
                uuidv4(),
                fromGroupId,
                toGroupId,
                amount,
                success ? 1 : 0,
                success ? 0 : 1,
            ]);
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
            const result = await db.query('SELECT * FROM transactions WHERE transaction_id = $1', [transactionId]);

            if (result.rows.length === 0) {
                throw new Error('Transaction not found');
            }

            return result.rows[0];
        } catch (error) {
            logger.error('Error fetching transaction', { error: error.message, transactionId });
            throw error;
        }
    }

    async cancelTransaction(transactionId) {
        try {
            const query = `
        UPDATE transactions 
        SET status = 'CANCELED', reason_code = 'USER_CANCELED'
        WHERE transaction_id = $1 AND status = 'PENDING'
        RETURNING *
      `;

            const result = await db.query(query, [transactionId]);

            if (result.rows.length === 0) {
                throw new Error('Transaction not found or cannot be canceled');
            }

            logger.info('Transaction canceled', { transactionId });

            return result.rows[0];
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
            // Assuming 1 active wallet per user for simplicity
            const { rows: userWallets } = await db.query(
                "SELECT * FROM wallets WHERE user_id = $1 AND currency = 'CREDITS' AND status = 'active' LIMIT 1",
                [userId]
            );

            if (userWallets.length === 0) {
                // Fallback: Check if they found an old PTS wallet that migrated
                throw new Error('No active CREDITS wallet found for user');
            }
            const sourceWallet = userWallets[0];

            // 2. Get Destination Wallet (Group - CREDITS)
            let { rows: groupWallets } = await db.query(
                "SELECT * FROM wallets WHERE group_id = $1 AND currency = 'CREDITS' AND status = 'active' LIMIT 1",
                [groupId]
            );

            let destWalletId;
            if (groupWallets.length === 0) {
                // Create CREDITS wallet for Group if missing
                logger.info(`Creating CREDITS wallet for group ${groupId}`);
                const newWalletId = uuidv4();
                // We need admin_user_id to create wallet? Schema allows null user_id if group_id is present
                await db.query(
                    `INSERT INTO wallets (wallet_id, group_id, currency, balance, status)
                     VALUES ($1, $2, 'CREDITS', 0.00000000, 'active')`,
                    [newWalletId, groupId]
                );
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

        const result = await db.query(
            `INSERT INTO payment_requests (bde_group_id, student_user_id, amount, description, status)
             VALUES ($1, $2, $3, $4, 'PENDING')
             RETURNING *`,
            [bdeGroupId, studentUserId, amount, description]
        );
        return result.rows[0];
    }

    /**
     * Get pending payment requests for a student
     */
    async getStudentPaymentRequests(studentUserId) {
        const result = await db.query(
            `SELECT pr.*, g.group_name 
             FROM payment_requests pr
             JOIN groups g ON pr.bde_group_id = g.group_id
             WHERE pr.student_user_id = $1 AND pr.status = 'PENDING'
             ORDER BY pr.created_at DESC`,
            [studentUserId]
        );
        return result.rows;
    }

    /**
     * Get payment requests made by BDE
     */
    async getBDEPaymentRequests(bdeGroupId) {
        const result = await db.query(
            `SELECT pr.*, u.full_name, u.email
             FROM payment_requests pr
             JOIN users u ON pr.student_user_id = u.user_id
             WHERE pr.bde_group_id = $1
             ORDER BY pr.created_at DESC`,
            [bdeGroupId]
        );
        return result.rows;
    }

    /**
     * Respond to payment request (Pay or Reject)
     */
    async respondToPaymentRequest(requestId, studentUserId, action) { // action: 'PAY' or 'REJECT'
        const reqRes = await db.query("SELECT * FROM payment_requests WHERE request_id = $1", [requestId]);
        const request = reqRes.rows[0];

        if (!request) throw new Error("Request not found");
        if (request.student_user_id !== studentUserId) throw new Error("Unauthorized");
        if (request.status !== 'PENDING') throw new Error("Request already processed");

        if (action === 'REJECT') {
            await db.query("UPDATE payment_requests SET status = 'REJECTED', updated_at = NOW() WHERE request_id = $1", [requestId]);
            return { status: 'REJECTED' };
        }

        if (action === 'PAY') {
            return await db.transaction(async (client) => {
                // 1. Initiate Transfer
                // user->bde transaction logic replicated or called
                // We need wallet IDs.

                // Get Student Wallet (CREDITS)
                const sWalletRes = await client.query(
                    "SELECT wallet_id FROM wallets WHERE user_id = $1 AND currency = 'CREDITS' LIMIT 1",
                    [studentUserId]
                );
                if (sWalletRes.rows.length === 0) throw new Error("No CREDITS wallet found");
                const sourceWalletId = sWalletRes.rows[0].wallet_id;

                // Get BDE Wallet (CREDITS)
                const bWalletRes = await client.query(
                    "SELECT wallet_id FROM wallets WHERE group_id = $1 AND currency = 'CREDITS' LIMIT 1",
                    [request.bde_group_id]
                );
                // Create if missing logic omitted for brevity, assume exists per migration/service
                if (bWalletRes.rows.length === 0) throw new Error("BDE has no CREDITS wallet");
                const destWalletId = bWalletRes.rows[0].wallet_id;

                // Check Balance
                const balanceRes = await walletService.getBalance(sourceWalletId);
                if (balanceRes.availableBalance < parseFloat(request.amount)) {
                    throw new Error("Insufficient funds");
                }

                // Execute Transfer
                await walletService.updateBalance(client, sourceWalletId, -parseFloat(request.amount));
                await walletService.updateBalance(client, destWalletId, parseFloat(request.amount));

                // Log Transaction
                await client.query(
                    `INSERT INTO transactions (transaction_id, initiator_user_id, source_wallet_id, destination_wallet_id, amount, currency, transaction_type, direction, status, description, created_at)
                     VALUES ($1, $2, $3, $4, $5, 'CREDITS', 'PAYMENT', 'outgoing', 'SUCCESS', $6, NOW())`,
                    [uuidv4(), studentUserId, sourceWalletId, destWalletId, request.amount, `Paiement demande: ${request.description}`]
                );

                // Update Request Status
                await client.query("UPDATE payment_requests SET status = 'PAID', updated_at = NOW() WHERE request_id = $1", [requestId]);

                return { status: 'PAID' };
            });
        }
    }
}

module.exports = new TransactionService();
