const logger = require('../config/logger');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');

// Mock Product Mapping: Polar Product ID -> Credits Amount
const PRODUCT_MAPPING = {
    'product_10_eur': 100,    // 10 EUR = 100 Credits
    'product_20_eur': 250,    // 20 EUR = 250 Credits (Bonus)
    'product_50_eur': 1000    // 50 EUR = 1000 Credits (Big Bonus)
};

class PaymentService {
    async processWebhook(payload) {
        // In real life, verify signature via webhook secret

        const { type, data } = payload;

        if (type !== 'order.created' && type !== 'order.paid') {
            logger.info(`Ignoring webhook event: ${type}`);
            return;
        }

        // Adapted to Polar generic payload structure
        // data.product_id or data.product.id depending on API version
        // data.customer_email or data.user.email

        const productId = data.product_id || (data.product && data.product.id) || 'product_10_eur'; // Fallback for demo
        const userEmail = data.customer_email || data.email;

        if (!userEmail) {
            logger.error('Webhook payload missing email');
            throw new Error('No email found in payload');
        }

        const creditsToAdd = PRODUCT_MAPPING[productId] || 0;

        if (creditsToAdd === 0) {
            logger.warn(`Unknown product ID: ${productId}`);
            return;
        }

        logger.info(`Processing payment for ${userEmail}: +${creditsToAdd} credits`);

        await this.creditUser(userEmail, creditsToAdd);
    }

    async creditUser(email, points) {
        // Find user by email
        const { rows: users } = await db.query('SELECT user_id FROM users WHERE email = $1', [email]);
        const user = users[0];

        if (!user) {
            logger.warn(`User not found for payment: ${email}.`);
            return;
        }

        // Find user's wallet (CREDITS)
        const { rows: wallets } = await db.query(
            "SELECT wallet_id FROM wallets WHERE user_id = $1 AND currency = 'CREDITS' LIMIT 1",
            [user.user_id]
        );
        let wallet = wallets[0];

        if (!wallet) {
            // Check for legacy PTS/EPIC wallet fallback if migration missed some
            const { rows: legacy } = await db.query(
                "SELECT wallet_id FROM wallets WHERE user_id = $1 AND currency IN ('PTS', 'EPIC') LIMIT 1",
                [user.user_id]
            );
            wallet = legacy[0];
        }

        if (!wallet) {
            logger.error(`No wallet found for user ${user.user_id}`);
            return;
        }

        // Calculate Revenue in EUR (Product Price from details)
        const REVENUE_MAPPING = {
            100: 10,  // 10 EUR
            250: 20,  // 20 EUR
            1000: 50  // 50 EUR
        };
        const revenueEur = REVENUE_MAPPING[points] || 0;

        await db.transaction(async (client) => {
            // 1. Credit Student (CREDITS)
            await client.query(
                "UPDATE wallets SET balance = balance + $1 WHERE wallet_id = $2",
                [points, wallet.wallet_id]
            );

            // 2. Credit BDE (EUR)
            const { rows: bdeWallets } = await client.query("SELECT wallet_id FROM wallets WHERE currency = 'EUR' LIMIT 1");

            if (bdeWallets.length > 0) {
                const bdeWalletId = bdeWallets[0].wallet_id;
                await client.query(
                    "UPDATE wallets SET balance = balance + $1 WHERE wallet_id = $2",
                    [revenueEur, bdeWalletId]
                );

                // Record BDE Transaction (Revenue)
                await client.query(
                    `INSERT INTO transactions (transaction_id, destination_wallet_id, amount, currency, transaction_type, direction, status, description, created_at)
                     VALUES ($1, $2, $3, 'EUR', 'PURCHASE', 'incoming', 'SUCCESS', 'Vente Pack Credits', NOW())`,
                    [uuidv4(), bdeWalletId, revenueEur]
                );
                logger.info(`Credited BDE Wallet ${bdeWalletId}: +${revenueEur} EUR`);
            } else {
                logger.warn("No BDE (EUR) Wallet found to credit revenue.");
            }

            // 3. Record Student Transaction (Credit Load)
            await client.query(
                `INSERT INTO transactions (transaction_id, destination_wallet_id, amount, currency, transaction_type, direction, status, description, created_at)
                 VALUES ($1, $2, $3, 'CREDITS', 'CASHIN', 'incoming', 'SUCCESS', 'Achat Credits', NOW())`,
                [uuidv4(), wallet.wallet_id, points]
            );
        });

        logger.info(`Successfully processed payment: Student +${points} CREDITS, BDE +${revenueEur} EUR`);
    }
}

module.exports = new PaymentService();
