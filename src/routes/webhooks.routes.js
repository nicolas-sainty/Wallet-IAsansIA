const express = require('express');
const stripeService = require('../services/stripe.service');
const walletService = require('../services/wallet.service');
const { supabase } = require('../config/database');
const logger = require('../config/logger');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

router.post('/stripe', async (req, res) => {
    const signature = req.headers['stripe-signature'];
    let event;

    try {
        event = stripeService.constructEvent(req.rawBody, signature);
    } catch (err) {
        logger.error('Webhook signature verification failed.', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const { userId, groupId, creditsAmount } = session.metadata;
        const stripeSessionId = session.id;
        const amountEur = session.amount_total / 100;

        logger.info(`Payment successful for user ${userId}. Amount: ${amountEur} EUR, Credits: ${creditsAmount}`);

        try {
            // Atomic + idempotent fulfillment (exactly once).
            const { data: rpcData, error } = await supabase.rpc(
                'rpc_fulfill_stripe_checkout_atomic',
                {
                    p_stripe_session_id: stripeSessionId,
                    p_user_id: userId,
                    p_bde_group_id: groupId,
                    p_credits_amount: parseFloat(creditsAmount),
                    p_amount_eur: parseFloat(amountEur),
                }
            );

            if (error) throw error;
            logger.info(`Stripe session processed (${stripeSessionId}): ${rpcData}`);

        } catch (error) {
            // Fallback for environments where the RPC isn't available yet.
            // We still try to keep idempotency using stripe_checkout_processed_sessions marker.
            logger.error('Error fulfilling order (RPC failed), fallback to legacy', { stripeSessionId, error: error.message });

            try {
                // Idempotency guard independent of marker table availability.
                const { data: existingTx } = await supabase
                    .from('transactions')
                    .select('transaction_id')
                    .eq('provider', 'stripe')
                    .eq('provider_tx_id', `${stripeSessionId}:credits`)
                    .maybeSingle();

                if (existingTx) {
                    return res.json({ received: true, alreadyProcessed: true });
                }

                // Attempt marker insertion to prevent double-credit on retries.
                const { error: markerErr } = await supabase
                    .from('stripe_checkout_processed_sessions')
                    .insert({
                        stripe_session_id: stripeSessionId,
                        user_id: userId,
                        bde_group_id: groupId,
                        credits_amount: parseFloat(creditsAmount),
                        amount_eur: parseFloat(amountEur),
                    });

                if (markerErr) {
                    const msg = (markerErr.message || '').toLowerCase();
                    const looksLikeDuplicate = msg.includes('duplicate') || msg.includes('unique');
                    if (looksLikeDuplicate) {
                        // Already processed on a retry.
                        logger.info('Stripe session already processed (marker duplicate)', { stripeSessionId });
                        return res.json({ received: true, alreadyProcessed: true });
                    }
                    // Marker table might not exist yet: proceed with legacy fulfillment.
                    logger.warn('Stripe marker insertion failed, proceeding without marker', { stripeSessionId, markerErr: markerErr.message });
                }

                // 1) Credit student's CREDITS wallet.
                let { data: userWallet, error: userWalletErr } = await supabase
                    .from('wallets')
                    .select('wallet_id')
                    .eq('user_id', userId)
                    .eq('currency', 'CREDITS')
                    .eq('status', 'active')
                    .single();

                if (userWalletErr || !userWallet) {
                    const created = await walletService.createWallet(userId, groupId, 'CREDITS');
                    userWallet = { wallet_id: created.wallet_id };
                }

                await walletService.updateBalance(null, userWallet.wallet_id, parseFloat(creditsAmount));
                await supabase.from('transactions').insert({
                    transaction_id: uuidv4(),
                    provider: 'stripe',
                    provider_tx_id: `${stripeSessionId}:credits`,
                    initiator_user_id: userId,
                    source_wallet_id: null,
                    destination_wallet_id: userWallet.wallet_id,
                    amount: parseFloat(creditsAmount),
                    currency: 'CREDITS',
                    transaction_type: 'CASHIN',
                    direction: 'incoming',
                    status: 'SUCCESS',
                    description: 'Achat de credits (Stripe)'
                });

                // 2) Credit BDE EUR wallet (group wallet: user_id IS NULL).
                let { data: bdeWallet, error: bdeWalletErr } = await supabase
                    .from('wallets')
                    .select('wallet_id')
                    .eq('group_id', groupId)
                    .eq('currency', 'EUR')
                    .is('user_id', null)
                    .eq('status', 'active')
                    .single();

                if (bdeWalletErr || !bdeWallet) {
                    const { data: createdBdeWallet, error: createErr } = await supabase
                        .from('wallets')
                        .insert({
                            group_id: groupId,
                            user_id: null,
                            currency: 'EUR',
                            balance: 0.00000000,
                            status: 'active'
                        })
                        .select('wallet_id')
                        .single();

                    if (createErr) throw createErr;
                    bdeWallet = createdBdeWallet;
                }

                await walletService.updateBalance(null, bdeWallet.wallet_id, parseFloat(amountEur));
                await supabase.from('transactions').insert({
                    transaction_id: uuidv4(),
                    provider: 'stripe',
                    provider_tx_id: `${stripeSessionId}:eur`,
                    initiator_user_id: userId,
                    source_wallet_id: null,
                    destination_wallet_id: bdeWallet.wallet_id,
                    amount: parseFloat(amountEur),
                    currency: 'EUR',
                    transaction_type: 'CASHIN',
                    direction: 'incoming',
                    status: 'SUCCESS',
                    description: 'Vente credits (Stripe)'
                });

                return res.json({ received: true, fallback: true });
            } catch (legacyError) {
                logger.error('Legacy Stripe fulfillment failed', { stripeSessionId, error: legacyError.message });
                return res.status(500).send('Fulfillment Error');
            }
        }
    }

    res.json({ received: true });
});

module.exports = router;
