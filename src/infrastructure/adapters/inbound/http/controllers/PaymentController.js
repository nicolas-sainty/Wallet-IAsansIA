/**
 * Contrôleur Express pour les paiements (Architecture Hexagonale)
 */
class PaymentController {
    constructor(createCheckoutSessionUseCase, getPaymentRequestsUseCase, respondToPaymentRequestUseCase) {
        this.createCheckoutSessionUseCase = createCheckoutSessionUseCase;
        this.getPaymentRequestsUseCase = getPaymentRequestsUseCase;
        this.respondToPaymentRequestUseCase = respondToPaymentRequestUseCase;
    }

    async createSession(req, res) {
        try {
            const { amount, credits, groupId } = req.body;
            const userId = req.user.user_id;

            const session = await this.createCheckoutSessionUseCase.execute({ userId, amount, credits, groupId });
            return res.json({ success: true, url: session.url, sessionId: session.sessionId });
        } catch (error) {
            return res.status(500).json({ success: false, error: error.message });
        }
    }

    async getRequests(req, res) {
        try {
            const { user_id: userId, role, bde_id: bdeId } = req.user;
            const requests = await this.getPaymentRequestsUseCase.execute({ userId, bdeId, role });
            return res.json({ success: true, data: requests });
        } catch (error) {
            return res.status(500).json({ success: false, error: error.message });
        }
    }

    async respondToRequest(req, res) {
        try {
            const { id: requestId } = req.params;
            const { action } = req.body;
            const userId = req.user.user_id;

            const result = await this.respondToPaymentRequestUseCase.execute({ requestId, userId, action });
            return res.json({ success: true, data: result });
        } catch (error) {
            return res.status(500).json({ error: error.message });
        }
    }
}

module.exports = PaymentController;
