const express = require('express');
const paymentService = require('../services/payment.service');
const logger = require('../config/logger');

const router = express.Router();

router.post('/polar', async (req, res) => {
    try {
        // Polar sends JSON payload
        await paymentService.processWebhook(req.body);
        res.status(200).json({ received: true });
    } catch (error) {
        logger.error('Webhook processing failed', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
