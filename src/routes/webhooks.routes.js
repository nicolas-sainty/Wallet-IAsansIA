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
        const amountEur = session.amount_total / 100;

        logger.info(`Payment successful for user ${userId}. Amount: ${amountEur} EUR, Credits: ${creditsAmount}`);

        try {
            // 1. Credit User's Credit Wallet
            const { data: userWallets } = await supabase
                .from('wallets')
                .select('wallet_id')
                .eq('user_id', userId)
                .eq('currency', 'CREDITS')
                .eq('status', 'active')
                .single();

            if (userWallets) {
                await walletService.updateBalance(null, userWallets.wallet_id, parseFloat(creditsAmount));

                // Log transaction System -> User (Credits)
                await supabase.from('transactions').insert({
                    transaction_id: uuidv4(),
                    source_wallet_id: uuidv4(), // System/Null
                    destination_wallet_id: userWallets.wallet_id,
                    amount: parseFloat(creditsAmount),
                    currency: 'CREDITS',
                    transaction_type: 'DEPOSIT',
                    status: 'SUCCESS',
                    description: 'Achat de crédits (Stripe)'
                });
            }

            // 2. Credit BDE's EUR Wallet
            if (groupId) {
                const { data: bdeWallets } = await supabase
                    .from('wallets')
                    .select('wallet_id')
                    .eq('group_id', groupId)
                    .eq('currency', 'EUR')
                    .is('user_id', null)
                    .eq('status', 'active')
                    .single();

                if (bdeWallets) {
                    await walletService.updateBalance(null, bdeWallets.wallet_id, parseFloat(amountEur));

                    // Log transaction System -> BDE (EUR)
                    await supabase.from('transactions').insert({
                        transaction_id: uuidv4(),
                        source_wallet_id: uuidv4(), // System/Null
                        destination_wallet_id: bdeWallets.wallet_id,
                        amount: parseFloat(amountEur),
                        currency: 'EUR',
                        transaction_type: 'DEPOSIT',
                        status: 'SUCCESS',
                        description: `Vente crédits: User ${userId}`
                    });
                }
            }

        } catch (error) {
            logger.error('Error fulfilling order', error);
            // Stripe will retry if we return 500, so maybe return 200 but log error
            // Or return 500 to let Stripe retry
            return res.status(500).send('Fulfillment Error');
        }
    }

    res.json({ received: true });
});

module.exports = router;
