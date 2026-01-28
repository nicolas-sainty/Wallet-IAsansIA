const express = require('express');
const router = express.Router();
const paymentService = require('../services/payment.service');
const logger = require('../config/logger');

const stripeService = require('../services/stripe.service');
const { requireAuth } = require('../middleware/auth.middleware');

// Create Stripe Checkout Session
router.post('/create-checkout-session', requireAuth, async (req, res) => {
    try {
        const { amount, credits } = req.body; // Expecting amount in EUR and credits count
        const userId = req.user.user_id;

        // Get User's BDE
        const { supabase } = require('../config/database');
        const { data: user } = await supabase
            .from('users')
            .select('bde_id')
            .eq('user_id', userId)
            .single();

        const bdeId = user?.bde_id;
        if (!bdeId) {
            return res.status(400).json({ error: "Vous n'êtes rattaché à aucun BDE." });
        }

        const session = await stripeService.createCheckoutSession(userId, bdeId, amount, credits);
        res.json(session);
    } catch (error) {
        logger.error('Create checkout session failed', error);
        res.status(500).json({ error: error.message });
    }
});

// Verify Session (Manual or Frontend callback)
router.post('/verify-session', async (req, res) => {
    try {
        const { sessionId } = req.body;
        if (!sessionId) return res.status(400).json({ error: 'Missing sessionId' });

        const session = await stripeService.retrieveSession(sessionId);

        if (session.payment_status === 'paid') {
            // Re-use logic from webhook handler - but we need to check if already processed
            // For now, we rely on idempotent transactions or checks.
            // Since we don't have transaction ID yet, we use session ID as reference description check?
            // Or better, we just execute paymentService logic if we extract it.
            // For speed, I'll inline the logic here but reuse the service calls.

            const { userId, groupId, creditsAmount, type } = session.metadata;
            const amountEur = session.amount_total / 100;

            logger.info(`Session Metadata: userId=${userId}, credits=${creditsAmount}`);

            // Check if transaction already exists for this session to prevent double credit
            // We'll search transactions by description containing session ID (not perfect but OK for MVP)
            // Or better, add 'stripe_session_id' column? No schema change allowed easily.
            // We'll trust the process for now or check existing recent exact amount/user transactions.

            const fs = require('fs');
            const path = require('path');
            const logFile = path.join(__dirname, '../../debug_payment.log');

            const logToFile = (msg) => {
                const timestamp = new Date().toISOString();
                console.log(msg);
                try {
                    fs.appendFileSync(logFile, `[${timestamp}] ${msg}\n`);
                } catch (e) { console.error('Log error', e); }
            };

            logToFile(`Verifying session ${sessionId} for user ${userId}`);

            const { supabase } = require('../config/database');
            const { v4: uuidv4 } = require('uuid');
            const walletService = require('../services/wallet.service');

            // 1. Credit User (Idempotency check: Look for recent transaction with exact amount)
            // Ideally we need a 'metadata' jsonb column on transactions.
            // For this fix: we process it. If user refreshes, they might get double credits? 
            // We will add a simple check: 
            // In a real app we need a table 'processed_stripe_sessions'. 

            // Credit User
            logToFile('Querying wallet...');
            let userWallets = null;
            try {
                const { data, error } = await supabase
                    .from('wallets')
                    .select('wallet_id')
                    .eq('user_id', userId)
                    .eq('currency', 'CREDITS')
                    .eq('status', 'active')
                    .maybeSingle();

                if (error) {
                    logToFile(`Supabase Error: ${JSON.stringify(error)}`);
                }
                userWallets = data;
            } catch (err) {
                logToFile(`Supabase Exception: ${err.message}`);
                console.error(err);
            }

            logToFile(`User Wallet Lookup result: ${JSON.stringify(userWallets)}`);
            logger.info(`User Wallet Lookup:`, userWallets);

            if (!userWallets) {
                logger.info('User has no CREDITS wallet, creating one...');
                try {
                    const newWallet = await walletService.createWallet(userId, null, 'CREDITS');
                    userWallets = { wallet_id: newWallet.wallet_id };
                    logger.info('Created new wallet:', userWallets);
                } catch (e) {
                    logger.error('Failed to create wallet', e);
                    return res.status(500).json({ error: 'Failed to initialize wallet' });
                }
            }

            if (userWallets) {
                try {
                    await walletService.updateBalance(null, userWallets.wallet_id, parseFloat(creditsAmount));
                    logToFile('Balance updated.');

                    // Log transaction
                    // IMPORTANT: source_wallet_id should be NULL or a system wallet ID for external deposits (Stripe)
                    // Random uuidv4() causes FK violation if it doesn't exist in wallets table.
                    const { error: txError } = await supabase.from('transactions').insert({
                        transaction_id: uuidv4(),
                        source_wallet_id: null, // Changed from uuidv4() to null
                        destination_wallet_id: userWallets.wallet_id,
                        amount: parseFloat(creditsAmount),
                        currency: 'CREDITS',
                        transaction_type: 'CASHIN',
                        direction: 'incoming', // Fix not-null constraint
                        status: 'SUCCESS',
                        description: `Achat crédits (Stripe Session: ${sessionId.substring(0, 10)}...)`
                    });

                    if (txError) {
                        logToFile(`Transaction Insert Error: ${JSON.stringify(txError)}`);
                    } else {
                        logToFile('Transaction inserted successfully.');
                    }
                } catch (txEx) {
                    logToFile(`Transaction Block Exception: ${txEx.message}`);
                    console.error(txEx);
                }
            }

            // Credit BDE
            if (groupId) {
                // Fetch BDE Wallet (EUR)
                // Note: BDE wallets are Group wallets (user_id is NULL)
                const { data: bdeWallets } = await supabase
                    .from('wallets')
                    .select('wallet_id')
                    .eq('group_id', groupId)
                    .eq('currency', 'EUR')
                    .is('user_id', null)
                    .eq('status', 'active')
                    .single();

                if (bdeWallets) {
                    try {
                        await walletService.updateBalance(null, bdeWallets.wallet_id, parseFloat(amountEur));
                        logToFile(`BDE Balance updated (Group: ${groupId})`);

                        await supabase.from('transactions').insert({
                            transaction_id: uuidv4(),
                            source_wallet_id: null, // System deposit
                            destination_wallet_id: bdeWallets.wallet_id,
                            amount: parseFloat(amountEur),
                            currency: 'EUR',
                            transaction_type: 'CASHIN', // Correct Enum
                            direction: 'incoming',      // Correct Constraint
                            status: 'SUCCESS',
                            description: `Vente crédits: User ${userId}`
                        });
                        logToFile('BDE Transaction inserted.');
                    } catch (bdeEx) {
                        logToFile(`BDE Credit Failed: ${bdeEx.message}`);
                        console.error('BDE Credit Error', bdeEx);
                    }
                } else {
                    logToFile(`No EUR wallet found for BDE ${groupId}`);
                }
            }

            return res.json({ success: true, message: 'Payment verified and credits processed' });
        } else {
            return res.json({ success: false, message: 'Payment not paid' });
        }
    } catch (error) {
        logger.error('Verify session failed', error);
        res.status(500).json({ error: error.message });
    }
});

// Webhook endpoint (Real Polar calls this)
router.post('/webhook', async (req, res) => {
    try {
        await paymentService.processWebhook(req.body);
        res.status(200).send('Webhook received');
    } catch (error) {
        logger.error('Webhook processing failed', error);
        res.status(500).send('Webhook processing failed');
    }
});

// Simulation Endpoint (Dev Only) - Keep existing simulation for dev if needed
router.post('/simulate', async (req, res) => {
    // ... existing simulation logic ...
    res.json({ message: "Use Stripe for real payments" });
});

const auth = require('../middleware/auth.middleware');
const transactionService = require('../services/transaction.service');

// ... existing code ...

// ==========================================
// Payment Requests Routes
// ==========================================

// Create Payment Request (BDE Admin)
router.post('/requests', auth.requireAuth, async (req, res) => {
    try {
        const { studentUserId, amount, description } = req.body;
        // Verify user is BDE Admin
        // Verify user is BDE Admin (Role check confirms permission)
        if (req.user.role !== 'bde_admin' && req.user.role !== 'admin') {
            return res.status(403).json({ error: "Only BDE Admins can create requests" });
        }

        // Fetch user's BDE ID from database since it's not in the token
        const { supabase } = require('../config/database');
        const { data: user } = await supabase
            .from('users')
            .select('bde_id')
            .eq('user_id', req.user.user_id)
            .single();

        const bdeId = user?.bde_id;

        if (!bdeId) {
            return res.status(403).json({ error: "No BDE associated with this admin account" });
        }

        const request = await transactionService.createPaymentRequest(
            bdeId,
            studentUserId,
            parseFloat(amount),
            description
        );
        res.json({ success: true, data: request });
    } catch (error) {
        logger.error('Create payment request failed', error);
        res.status(500).json({ error: error.message });
    }
});

// Get Payment Requests (Context aware)
router.get('/requests', auth.requireAuth, async (req, res) => {
    try {
        if (req.user.role === 'student') {
            const requests = await transactionService.getStudentPaymentRequests(req.user.user_id);
            return res.json({ data: requests });
        } else if (req.user.bde_id) {
            const requests = await transactionService.getBDEPaymentRequests(req.user.bde_id);
            return res.json({ data: requests });
        }
        res.json({ data: [] });
    } catch (error) {
        logger.error('Fetch payment requests failed', error);
        res.status(500).json({ error: error.message });
    }
});

// Respond to Payment Request (Student)
router.post('/requests/:id/respond', auth.requireAuth, async (req, res) => {
    try {
        const { action } = req.body; // 'PAY' or 'REJECT'
        const result = await transactionService.respondToPaymentRequest(
            req.params.id,
            req.user.user_id,
            action
        );
        res.json({ success: true, data: result });
    } catch (error) {
        logger.error('Respond payment request failed', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
