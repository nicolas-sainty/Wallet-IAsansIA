/**
 * Cas d'utilisation: Créer une session de paiement Stripe
 */
class CreateCheckoutSession {
    constructor(paymentProcessor, logger) {
        this.paymentProcessor = paymentProcessor;
        this.logger = logger;
    }

    async execute({ userId, amount, credits, groupId = null }) {
        const session = await this.paymentProcessor.createCheckoutSession({ userId, amount, credits, groupId });
        this.logger.info('Session de paiement créée (Architecture Hexagonale)', { userId, sessionId: session.sessionId });
        return session;
    }
}

module.exports = CreateCheckoutSession;
