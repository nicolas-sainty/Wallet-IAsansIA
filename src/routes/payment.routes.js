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
        let amount = 0;
        let cost = 0;
        switch (productId) {
            case 'pack_10': // Pack Découverte (2€)
                amount = 20;
                cost = 2;
                break;
            case 'pack_50': // Pack Standard (5€)
                amount = 50;
                cost = 5;
                break;
            case 'pack_100': // Pack Premium (10€)
                amount = 100;
                cost = 10;
                break;
            default:
                amount = 10;
                cost = 1;
        }

        const mockPayload = {
            type: 'order.paid',
            data: {
                product_id: productId,
                customer_email: email,
                amount: amount, // Add this
                cost: cost      // Add this
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
        // Verify user is BDE Admin (Role check confirms permission)
        if (req.user.role !== 'bde_admin' && req.user.role !== 'admin') {
            return res.status(403).json({ error: "Only BDE Admins can create requests" });
        }

        // Fetch user's BDE ID from database since it's not in the token
        const { supabase } = require('../config/database');
        const { data: user } = await supabase
            .from('users')
            .select('bde_id')
            .eq('user_id', req.user.user_id)
            .single();

        const bdeId = user?.bde_id;

        if (!bdeId) {
            return res.status(403).json({ error: "No BDE associated with this admin account" });
        }

        const request = await transactionService.createPaymentRequest(
            bdeId,
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
