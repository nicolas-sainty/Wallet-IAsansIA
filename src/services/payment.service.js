const logger = require('../config/logger');
const { v4: uuidv4 } = require('uuid');
const { supabase } = require('../config/database');

// Mock Product Mapping: Polar Product ID -> Credits Amount
const PRODUCT_MAPPING = {
    'pack_10': 20,    // 2 EUR = 20 Credits
    'pack_50': 50,    // 5 EUR = 50 Credits
    'pack_100': 100,  // 10 EUR = 100 Credits
    // Legacy support
    'product_10_eur': 100,
    'product_20_eur': 250,
    'product_50_eur': 1000
};

class PaymentService {
    async processWebhook(payload) {
        // In real life, verify signature via webhook secret

        const { type, data } = payload;

        if (type !== 'order.created' && type !== 'order.paid') {
            logger.info(`Ignoring webhook event: ${type}`);
            return;
        }

        const productId = data.product_id || (data.product && data.product.id) || 'pack_10';
        const userEmail = data.customer_email || data.email;

        // Use amount directly if provided (from simulation), otherwise map from ID
        let creditsToAdd = 0;
        if (data.amount) {
            creditsToAdd = parseInt(data.amount);
        } else {
            creditsToAdd = PRODUCT_MAPPING[productId] || 0;
        }

        if (!userEmail) {
            logger.error('Webhook payload missing email');
            throw new Error('No email found in payload');
        }

        if (creditsToAdd === 0) {
            logger.warn(`Unknown product ID: ${productId}`);
            return;
        }

        logger.info(`Processing payment for ${userEmail}: +${creditsToAdd} credits`);

        await this.creditUser(userEmail, creditsToAdd);
    }

    async creditUser(email, points) {
        // Find user by email
        const { data: users, error: userError } = await supabase
            .from('users')
            .select('user_id')
            .eq('email', email);

        if (userError || !users || users.length === 0) {
            logger.warn(`User not found for payment: ${email}.`);
            return;
        }

        const user = users[0];

        // Find user's wallet (CREDITS)
        const { data: wallets, error: walletError } = await supabase
            .from('wallets')
            .select('wallet_id, balance')
            .eq('user_id', user.user_id)
            .eq('currency', 'CREDITS')
            .limit(1);

        let wallet = wallets && wallets.length > 0 ? wallets[0] : null;

        if (!wallet) {
            // Check for legacy PTS/EPIC wallet fallback
            const { data: legacyWallets } = await supabase
                .from('wallets')
                .select('wallet_id, balance')
                .eq('user_id', user.user_id)
                .in('currency', ['PTS', 'EPIC'])
                .limit(1);

            wallet = legacyWallets && legacyWallets.length > 0 ? legacyWallets[0] : null;
        }

        if (!wallet) {
            logger.error(`No wallet found for user ${user.user_id}`);
            return;
        }

        // Calculate Revenue in EUR
        const REVENUE_MAPPING = {
            20: 2,
            50: 5,
            100: 10
        };
        // If exact match not found (legacy?), estimate 0.1 ratio
        const revenueEur = REVENUE_MAPPING[points] || (points / 10);

        // NOTE: Supabase JS client doesn't support transactions
        // This is a simplified version - for production, create an RPC function
        try {
            // 1. Credit Student (CREDITS)
            const newBalance = parseFloat(wallet.balance) + points;
            await supabase
                .from('wallets')
                .update({ balance: newBalance })
                .eq('wallet_id', wallet.wallet_id);

            // 2. Credit BDE (EUR)
            const { data: bdeWallets } = await supabase
                .from('wallets')
                .select('wallet_id, balance')
                .eq('currency', 'EUR')
                .limit(1);

            if (bdeWallets && bdeWallets.length > 0) {
                const bdeWallet = bdeWallets[0];
                const newBdeBalance = parseFloat(bdeWallet.balance) + revenueEur;

                await supabase
                    .from('wallets')
                    .update({ balance: newBdeBalance })
                    .eq('wallet_id', bdeWallet.wallet_id);

                // Record BDE Transaction
                await supabase
                    .from('transactions')
                    .insert({
                        transaction_id: uuidv4(),
                        destination_wallet_id: bdeWallet.wallet_id,
                        amount: revenueEur,
                        currency: 'EUR',
                        transaction_type: 'PURCHASE',
                        direction: 'incoming',
                        status: 'SUCCESS',
                        description: 'Vente Pack Credits'
                    });

                logger.info(`Credited BDE Wallet ${bdeWallet.wallet_id}: +${revenueEur} EUR`);
            } else {
                logger.warn("No BDE (EUR) Wallet found to credit revenue.");
            }

            // 3. Record Student Transaction
            await supabase
                .from('transactions')
                .insert({
                    transaction_id: uuidv4(),
                    destination_wallet_id: wallet.wallet_id,
                    amount: points,
                    currency: 'CREDITS',
                    transaction_type: 'CASHIN',
                    direction: 'incoming',
                    status: 'SUCCESS',
                    description: 'Achat Credits'
                });

            logger.info(`Successfully processed payment: Student +${points} CREDITS, BDE +${revenueEur} EUR`);
        } catch (error) {
            logger.error('Error processing payment', error);
            throw error;
        }
    }
}

module.exports = new PaymentService();
