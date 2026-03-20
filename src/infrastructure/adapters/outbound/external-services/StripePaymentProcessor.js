const stripeService = require('../../../../services/stripe.service');

/**
 * Adaptateur pour le processeur de paiement utilisant Stripe
 */
class StripePaymentProcessor {
    async createCheckoutSession(params) {
        // Délègue au service Stripe existant
        // Signature: createCheckoutSession(userId, groupId, amountEUR, creditsAmount)
        return stripeService.createCheckoutSession(
            params.userId, 
            params.groupId || null, 
            params.amount, 
            params.credits
        );
    }

    async verifySession(sessionId) {
        return stripeService.verifySession(sessionId);
    }
}

module.exports = StripePaymentProcessor;
