const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const logger = require('../config/logger');
const { v4: uuidv4 } = require('uuid');

const dbPath = path.join(__dirname, '../../database/epicoin.sqlite');
const db = new sqlite3.Database(dbPath);

// Mock Product Mapping: Polar Product ID -> Points Amount
const PRODUCT_MAPPING = {
    'product_10_eur': 1000,
    'product_20_eur': 2200, // Bonus info
    'product_50_eur': 6000
};

const runQuery = (query, params = []) => {
    return new Promise((resolve, reject) => {
        db.run(query, params, function (err) {
            if (err) reject(err);
            else resolve(this);
        });
    });
};

const getQuery = (query, params = []) => {
    return new Promise((resolve, reject) => {
        db.get(query, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
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

        const pointsToAdd = PRODUCT_MAPPING[productId] || 0;

        if (pointsToAdd === 0) {
            logger.warn(`Unknown product ID: ${productId}`);
            return;
        }

        logger.info(`Processing payment for ${userEmail}: +${pointsToAdd} pts`);

        await this.creditUser(userEmail, pointsToAdd);
    }

    async creditUser(email, points) {
        // Find user by email
        const user = await getQuery('SELECT user_id FROM users WHERE email = ?', [email]);

        if (!user) {
            logger.warn(`User not found for payment: ${email}. Pending logic could be added here.`);
            return;
        }

        // Find user's wallet (assuming 1 wallet for simplicity or specific logic)
        // We pick the first active wallet for now, or the one linked to the main BDE
        const wallet = await getQuery('SELECT wallet_id FROM wallets WHERE user_id = ? LIMIT 1', [user.user_id]);

        if (!wallet) {
            // Create a wallet if none exists ? Or throw error
            logger.error(`No wallet found for user ${user.user_id}`);
            return;
        }

        // Update balance
        await runQuery(
            'UPDATE wallets SET balance = balance + ? WHERE wallet_id = ?',
            [points, wallet.wallet_id]
        );

        // Record Transaction (Deposit)
        await runQuery(
            `INSERT INTO transactions (transaction_id, wallet_id, amount, type, status, description, created_at)
             VALUES (?, ?, ?, 'deposit', 'completed', 'Rechargement Polar', datetime('now'))`,
            [uuidv4(), wallet.wallet_id, points]
        );

        logger.info(`Successfully credited ${points} pts to wallet ${wallet.wallet_id}`);
    }
}

module.exports = new PaymentService();
