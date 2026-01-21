const express = require('express');
const { body, param, validationResult } = require('express-validator');
const groupService = require('../services/group.service');
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
 * POST /api/groups
 * Create a new group
 */
router.post(
    '/',
    [
        body('groupName').notEmpty().isLength({ min: 3, max: 255 }),
        body('adminUserId').isUUID(),
        body('settings').optional().isObject(),
    ],
    validate,
    async (req, res) => {
        try {
            const { groupName, adminUserId, settings } = req.body;
            const group = await groupService.createGroup(groupName, adminUserId, settings);

            res.status(201).json({
                success: true,
                data: group,
            });
        } catch (error) {
            logger.error('Group creation failed', { error: error.message });
            res.status(500).json({
                success: false,
                error: error.message,
            });
        }
    }
);

/**
 * GET /api/groups
 * Get all groups
 */
router.get('/', async (req, res) => {
    try {
        const groups = await groupService.getAllGroups();

        res.json({
            success: true,
            data: groups,
            count: groups.length,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

/**
 * GET /api/groups/:groupId
 * Get group details
 */
router.get(
    '/:groupId',
    [param('groupId').isUUID()],
    validate,
    async (req, res) => {
        try {
            const { groupId } = req.params;
            const group = await groupService.getGroup(groupId);

            res.json({
                success: true,
                data: group,
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
 * GET /api/groups/:groupId/members
 * Get group members (wallets)
 */
router.get(
    '/:groupId/members',
    [param('groupId').isUUID()],
    validate,
    async (req, res) => {
        try {
            const { groupId } = req.params;
            const members = await groupService.getGroupMembers(groupId);

            res.json({
                success: true,
                data: members,
                count: members.length,
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
 * GET /api/groups/:groupId/stats
 * Get group statistics
 */
router.get(
    '/:groupId/stats',
    [param('groupId').isUUID()],
    validate,
    async (req, res) => {
        try {
            const { groupId } = req.params;
            const stats = await groupService.getGroupStats(groupId);

            res.json({
                success: true,
                data: stats,
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
 * POST /api/groups/:groupId/rules
 * Set exchange rules for a group
 */
router.post(
    '/:groupId/rules',
    [
        param('groupId').isUUID(),
        body('toGroupId').isUUID(),
        body('maxTransactionAmount').optional().isFloat({ min: 0 }),
        body('dailyLimit').optional().isFloat({ min: 0 }),
        body('requiresApproval').optional().isBoolean(),
        body('commissionRate').optional().isFloat({ min: 0, max: 1 }),
        body('active').optional().isBoolean(),
    ],
    validate,
    async (req, res) => {
        try {
            const { groupId } = req.params;
            const { toGroupId, ...rules } = req.body;

            const exchangeRule = await groupService.setExchangeRules(
                groupId,
                toGroupId,
                rules
            );

            res.status(201).json({
                success: true,
                data: exchangeRule,
            });
        } catch (error) {
            logger.error('Setting exchange rules failed', { error: error.message });
            res.status(500).json({
                success: false,
                error: error.message,
            });
        }
    }
);

/**
 * GET /api/groups/:groupId/trust-scores
 * Get trust scores with other groups
 */
router.get(
    '/:groupId/trust-scores',
    [param('groupId').isUUID()],
    validate,
    async (req, res) => {
        try {
            const { groupId } = req.params;
            const trustScores = await groupService.getTrustScores(groupId);

            res.json({
                success: true,
                data: trustScores,
                count: trustScores.length,
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
