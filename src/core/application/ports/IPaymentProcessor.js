/**
 * Interface pour le processeur de paiement (Stripe, etc.)
 */
class IPaymentProcessor {
    async createCheckoutSession(params) { throw new Error('Method not implemented'); }
    async verifySession(sessionId) { throw new Error('Method not implemented'); }
}

module.exports = IPaymentProcessor;
