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
            const { supabase } = require('../config/database');
            const { userId, groupId, creditsAmount } = session.metadata || {};
            const amountEur = session.amount_total / 100;

            try {
                // Atomic + idempotent fulfillment via DB RPC.
                const { data: rpcData, error: rpcError } = await supabase.rpc(
                    'rpc_fulfill_stripe_checkout_atomic',
                    {
                        p_stripe_session_id: sessionId,
                        p_user_id: userId,
                        p_bde_group_id: groupId,
                        p_credits_amount: parseFloat(creditsAmount),
                        p_amount_eur: parseFloat(amountEur),
                    }
                );

                if (rpcError) throw rpcError;

                return res.json({
                    success: true,
                    message: 'Payment verified and credits processed',
                    result: rpcData,
                });
            } catch (error) {
                logger.error('Fulfillment RPC failed, using fallback logic', { error: error.message });

                const walletService = require('../services/wallet.service');
                const { v4: uuidv4 } = require('uuid');

                // Idempotency: verify if already credited
                const { data: existingTx } = await supabase
                    .from('transactions')
                    .select('transaction_id')
                    .eq('provider', 'stripe')
                    .eq('provider_tx_id', `${sessionId}:credits`)
                    .maybeSingle();

                if (existingTx) {
                    return res.json({ success: true, message: 'Payment already processed' });
                }

                // Credit Student (CREDITS)
                let { data: userWallet } = await supabase
                    .from('wallets')
                    .select('wallet_id, balance')
                    .eq('user_id', userId)
                    .eq('currency', 'CREDITS')
                    .eq('status', 'active')
                    .maybeSingle();

                if (!userWallet) {
                    const newWallet = await walletService.createWallet(userId, null, 'CREDITS');
                    userWallet = { wallet_id: newWallet.wallet_id };
                }

                await walletService.updateBalance(null, userWallet.wallet_id, parseFloat(creditsAmount));

                await supabase.from('transactions').insert({
                    transaction_id: uuidv4(),
                    provider: 'stripe',
                    provider_tx_id: `${sessionId}:credits`,
                    initiator_user_id: userId,
                    source_wallet_id: null,
                    destination_wallet_id: userWallet.wallet_id,
                    amount: parseFloat(creditsAmount),
                    currency: 'CREDITS',
                    transaction_type: 'CASHIN',
                    direction: 'incoming',
                    status: 'SUCCESS',
                    description: `Achat crédits (Stripe: ${sessionId.substring(0, 10)}...)`
                });

                // Credit BDE (EUR)
                if (groupId) {
                    const { data: bdeWallet } = await supabase
                        .from('wallets')
                        .select('wallet_id')
                        .eq('group_id', groupId)
                        .eq('currency', 'EUR')
                        .is('user_id', null)
                        .eq('status', 'active')
                        .maybeSingle();

                    if (bdeWallet) {
                        await walletService.updateBalance(null, bdeWallet.wallet_id, parseFloat(amountEur));
                        await supabase.from('transactions').insert({
                            transaction_id: uuidv4(),
                            provider: 'stripe',
                            provider_tx_id: `${sessionId}:eur`,
                            initiator_user_id: userId,
                            source_wallet_id: null,
                            destination_wallet_id: bdeWallet.wallet_id,
                            amount: parseFloat(amountEur),
                            currency: 'EUR',
                            transaction_type: 'CASHIN',
                            direction: 'incoming',
                            status: 'SUCCESS',
                            description: `Vente crédits: User ${userId}`
                        });
                    }
                }

                return res.json({ success: true, message: 'Payment verified and credits processed' });
            }
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
