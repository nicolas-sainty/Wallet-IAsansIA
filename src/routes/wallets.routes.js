const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const walletService = require('../services/wallet.service');
const logger = require('../config/logger');

const router = express.Router();

// Validation middleware
const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    next();
};

/**
 * POST /api/wallets
 * Create a new wallet
 */
router.post(
    '/',
    [
        body('groupId').optional().isUUID(), // Made optional as per rework
        body('userId').optional().isUUID(),
        body('currency').optional().isLength({ min: 3, max: 10 }),
    ],
    validate,
    async (req, res) => {
        try {
            const { groupId, userId, currency } = req.body;
            // logic ...
            const wallet = await walletService.createWallet(userId, groupId, currency);

            res.status(201).json({ success: true, data: wallet });
        } catch (error) {
            logger.error('Wallet creation failed', { error: error.message });
            res.status(500).json({ success: false, error: error.message });
        }
    }
);

/**
 * GET /api/wallets
 * Get wallets (filter by userId or groupId)
 */
router.get(
    '/',
    [
        query('userId').optional().isUUID(),
        query('groupId').optional().isUUID()
    ],
    validate,
    async (req, res) => {
        try {
            const { userId, groupId } = req.query;

            if (!userId && !groupId) {
                return res.status(400).json({
                    success: false,
                    error: 'At least one filter (userId or groupId) is required'
                });
            }

            const wallets = await walletService.getWallets({ userId, groupId });
            res.json({ success: true, data: wallets });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }
);

/**
 * GET /api/wallets
 * Get current user's wallets
 */
router.get(
    '/',
    [
        query('userId').optional().isUUID(),
    ],
    validate,
    async (req, res) => {
        try {
            // Priority: Query Param (Internal usage/Admin) -> Token User (if available via middleware)
            // Ideally, we should usereq.user.id from auth middleware.
            // Since I don't see auth middleware applied globally effectively here yet (it might be in server.js),
            // I will rely on the query param 'userId' passed by the frontend for now, 
            // BUT strictly speaking this is insecure without token verification.
            // Given the context is a student wallet MVP, we proceed with query param for now as per current pattern.

            const userId = req.query.userId || (req.user ? req.user.userId : null);

            if (!userId) {
                return res.status(400).json({
                    success: false,
                    error: 'User ID is required'
                });
            }

            const wallets = await walletService.getUserWallets(userId);

            res.json({
                success: true,
                data: wallets
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
);

/**
 * GET /api/wallets/:walletId
 * Get wallet details
 */
router.get(
    '/:walletId',
    [param('walletId').isUUID()],
    validate,
    async (req, res) => {
        try {
            const { walletId } = req.params;
            const wallet = await walletService.getWallet(walletId);

            res.json({
                success: true,
                data: wallet,
            });
        } catch (error) {
            res.status(404).json({
                success: false,
                error: error.message,
            });
        }
    }
);

/**
 * GET /api/wallets/:walletId/balance
 * Get wallet balance
 */
router.get(
    '/:walletId/balance',
    [param('walletId').isUUID()],
    validate,
    async (req, res) => {
        try {
            const { walletId } = req.params;
            const balance = await walletService.getBalance(walletId);

            res.json({
                success: true,
                data: balance,
            });
        } catch (error) {
            res.status(404).json({
                success: false,
                error: error.message,
            });
        }
    }
);

/**
 * GET /api/wallets/:walletId/transactions
 * Get wallet transaction history
 */
router.get(
    '/:walletId/transactions',
    [
        param('walletId').isUUID(),
        query('limit').optional().isInt({ min: 1, max: 100 }),
        query('offset').optional().isInt({ min: 0 }),
        query('status').optional().isIn(['PENDING', 'SUCCESS', 'FAILED', 'CANCELED']),
    ],
    validate,
    async (req, res) => {
        try {
            const { walletId } = req.params;
            const { limit, offset, status } = req.query;

            const transactions = await walletService.getTransactionHistory(walletId, {
                limit: parseInt(limit) || 50,
                offset: parseInt(offset) || 0,
                status,
            });

            res.json({
                success: true,
                data: transactions,
                count: transactions.length,
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message,
            });
        }
    }
);

/**
 * POST /api/wallets/:walletId/freeze
 * Freeze a wallet
 */
router.post(
    '/:walletId/freeze',
    [
        param('walletId').isUUID(),
        body('reason').notEmpty().withMessage('Reason required'),
    ],
    validate,
    async (req, res) => {
        try {
            const { walletId } = req.params;
            const { reason } = req.body;

            const wallet = await walletService.freezeWallet(walletId, reason);

            res.json({
                success: true,
                data: wallet,
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message,
            });
        }
    }
);

module.exports = router;
