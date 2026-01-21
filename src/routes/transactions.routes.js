const express = require('express');
const { body, param, validationResult } = require('express-validator');
const transactionService = require('../services/transaction.service');
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
 * POST /api/transactions
 * Initiate a new transaction
 */
router.post(
    '/',
    [
        body('initiatorUserId').isUUID().withMessage('Valid initiator user ID required'),
        body('sourceWalletId').isUUID().withMessage('Valid source wallet ID required'),
        body('destinationWalletId').isUUID().withMessage('Valid destination wallet ID required'),
        body('amount').isFloat({ min: 0.01 }).withMessage('Amount must be positive'),
        body('transactionType').isIn(['P2P', 'MERCHANT', 'CASHIN', 'CASHOUT']),
        body('currency').optional().isLength({ min: 3, max: 10 }),
        body('description').optional().isLength({ max: 500 }),
        body('country').optional().isLength({ min: 2, max: 3 }),
        body('city').optional().isLength({ max: 255 }),
    ],
    validate,
    async (req, res) => {
        try {
            const transaction = await transactionService.initiateTransaction(req.body);

            res.status(201).json({
                success: true,
                data: transaction,
                message: 'Transaction initiated successfully',
            });
        } catch (error) {
            logger.error('Transaction initiation failed', { error: error.message });
            res.status(400).json({
                success: false,
                error: error.message,
            });
        }
    }
);

/**
 * GET /api/transactions/:transactionId
 * Get transaction details
 */
router.get(
    '/:transactionId',
    [param('transactionId').isUUID()],
    validate,
    async (req, res) => {
        try {
            const { transactionId } = req.params;
            const transaction = await transactionService.getTransaction(transactionId);

            res.json({
                success: true,
                data: transaction,
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
 * GET /api/transactions/:transactionId/status
 * Get transaction status
 */
router.get(
    '/:transactionId/status',
    [param('transactionId').isUUID()],
    validate,
    async (req, res) => {
        try {
            const { transactionId } = req.params;
            const transaction = await transactionService.getTransaction(transactionId);

            res.json({
                success: true,
                data: {
                    transactionId: transaction.transaction_id,
                    status: transaction.status,
                    createdAt: transaction.created_at,
                    executedAt: transaction.executed_at,
                    reasonCode: transaction.reason_code,
                },
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
 * POST /api/transactions/:transactionId/cancel
 * Cancel a pending transaction
 */
router.post(
    '/:transactionId/cancel',
    [param('transactionId').isUUID()],
    validate,
    async (req, res) => {
        try {
            const { transactionId } = req.params;
            const transaction = await transactionService.cancelTransaction(transactionId);

            res.json({
                success: true,
                data: transaction,
                message: 'Transaction canceled successfully',
            });
        } catch (error) {
            res.status(400).json({
                success: false,
                error: error.message,
            });
        }
    }
);

module.exports = router;
