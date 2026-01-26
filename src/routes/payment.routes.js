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

const auth = require('../middleware/auth.middleware');
const transactionService = require('../services/transaction.service');

// ... existing code ...

// ==========================================
// Payment Requests Routes
// ==========================================

// Create Payment Request (BDE Admin)
router.post('/requests', auth.requireAuth, async (req, res) => {
    try {
        const { studentUserId, amount, description } = req.body;
        // Verify user is BDE Admin
        if (!req.user.bde_id || (req.user.role !== 'bde_admin' && req.user.role !== 'admin')) {
            return res.status(403).json({ error: "Only BDE Admins can create requests" });
        }

        const request = await transactionService.createPaymentRequest(
            req.user.bde_id,
            studentUserId,
            parseFloat(amount),
            description
        );
        res.json({ success: true, data: request });
    } catch (error) {
        logger.error('Create payment request failed', error);
        res.status(500).json({ error: error.message });
    }
});

// Get Payment Requests (Context aware)
router.get('/requests', auth.requireAuth, async (req, res) => {
    try {
        if (req.user.role === 'student') {
            const requests = await transactionService.getStudentPaymentRequests(req.user.user_id);
            return res.json({ data: requests });
        } else if (req.user.bde_id) {
            const requests = await transactionService.getBDEPaymentRequests(req.user.bde_id);
            return res.json({ data: requests });
        }
        res.json({ data: [] });
    } catch (error) {
        logger.error('Fetch payment requests failed', error);
        res.status(500).json({ error: error.message });
    }
});

// Respond to Payment Request (Student)
router.post('/requests/:id/respond', auth.requireAuth, async (req, res) => {
    try {
        const { action } = req.body; // 'PAY' or 'REJECT'
        const result = await transactionService.respondToPaymentRequest(
            req.params.id,
            req.user.user_id,
            action
        );
        res.json({ success: true, data: result });
    } catch (error) {
        logger.error('Respond payment request failed', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
