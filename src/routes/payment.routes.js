const express = require('express');
const router = express.Router();
const paymentService = require('../services/payment.service');
const logger = require('../config/logger');

// Webhook endpoint (Real Polar calls this)
router.post('/webhook', async (req, res) => {
    try {
        await paymentService.processWebhook(req.body);
        res.status(200).send('Webhook received');
    } catch (error) {
        logger.error('Webhook processing failed', error);
        res.status(500).send('Webhook processing failed');
    }
});

// Simulation Endpoint (Dev Only)
router.post('/simulate', async (req, res) => {
    try {
        const { productId, email } = req.body;

        if (!productId || !email) {
            return res.status(400).json({ error: 'Missing productId or email' });
        }

        // Mimic Polar Payload
        const mockPayload = {
            type: 'order.paid',
            data: {
                product_id: productId,
                customer_email: email
            }
        };

        await paymentService.processWebhook(mockPayload);

        res.json({ success: true, message: 'Purchase simulated successfully' });
    } catch (error) {
        logger.error('Simulation failed', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
