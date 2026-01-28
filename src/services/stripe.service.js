const Stripe = require('stripe');
const logger = require('../config/logger');
const { v4: uuidv4 } = require('uuid');

class StripeService {
    constructor() {
        this.stripe = null;
        if (process.env.STRIPE_SECRET_KEY) {
            this.stripe = Stripe(process.env.STRIPE_SECRET_KEY);
        } else {
            logger.warn('STRIPE_SECRET_KEY not found. Stripe service disabled.');
        }
    }

    /**
     * Create a Checkout Session for buying credits
     * @param {string} userId - User ID buying credits
     * @param {string} groupId - Group/BDE ID receiving the funds (conceptually)
     * @param {number} amountEUR - Amount in EUR
     * @param {number} creditsAmount - Amount of credits to receive
     * @returns {Promise<Object>} Session URL and ID
     */
    async createCheckoutSession(userId, groupId, amountEUR, creditsAmount) {
        if (!this.stripe) throw new Error('Stripe not configured');

        try {
            const session = await this.stripe.checkout.sessions.create({
                payment_method_types: ['card'],
                line_items: [
                    {
                        price_data: {
                            currency: 'eur',
                            product_data: {
                                name: `${creditsAmount} Credits Epicoin`,
                                description: `Achat de credits pour le Wallet`,
                            },
                            unit_amount: Math.round(amountEUR * 100), // cents
                        },
                        quantity: 1,
                    },
                ],
                mode: 'payment',
                success_url: `${process.env.APP_URL || 'http://localhost:3000'}/payment/success.html?session_id={CHECKOUT_SESSION_ID}`,
                cancel_url: `${process.env.APP_URL || 'http://localhost:3000'}/payment/cancel.html`,
                metadata: {
                    userId,
                    groupId,
                    creditsAmount,
                    type: 'CREDIT_PURCHASE'
                },
            });

            return { url: session.url, sessionId: session.id };
        } catch (error) {
            logger.error('Error creating Stripe session', error);
            throw error;
        }
    }

    /**
     * Verify webhook signature and return event
     * @param {string} signature 
     * @param {Buffer} items 
     */
    constructEvent(body, signature) {
        if (!this.stripe) throw new Error('Stripe not configured');
        return this.stripe.webhooks.constructEvent(
            body,
            signature,
            process.env.STRIPE_WEBHOOK_SECRET
        );
    }
    async retrieveSession(sessionId) {
        if (!this.stripe) throw new Error('Stripe not configured');
        try {
            return await this.stripe.checkout.sessions.retrieve(sessionId);
        } catch (error) {
            logger.error('Error retrieving Stripe session', error);
            throw error;
        }
    }
}

module.exports = new StripeService();
