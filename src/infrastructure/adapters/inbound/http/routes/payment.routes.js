const express = require('express');
const { requireAuth } = require('../../../../../middleware/auth.middleware');

function createPaymentRoutes(paymentController) {
    const router = express.Router();

    router.post('/create-checkout-session', requireAuth, (req, res) => paymentController.createSession(req, res));
    router.get('/requests', requireAuth, (req, res) => paymentController.getRequests(req, res));
    router.post('/requests/:id/respond', requireAuth, (req, res) => paymentController.respondToRequest(req, res));

    return router;
}

module.exports = createPaymentRoutes;
