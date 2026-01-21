const express = require('express');
const { body, param, validationResult } = require('express-validator');
const eventService = require('../services/event.service');
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
 * GET /api/events
 * Get all upcoming events
 */
router.get('/', async (req, res) => {
    try {
        const events = await eventService.getUpcomingEvents();
        res.json({
            success: true,
            data: events
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/events
 * Create a new event
 */
router.post(
    '/',
    [
        body('groupId').isUUID(),
        body('title').notEmpty(),
        body('eventDate').isISO8601(),
        body('rewardPoints').isFloat({ min: 0 })
    ],
    validate,
    async (req, res) => {
        try {
            const { groupId, title, description, eventDate, rewardPoints } = req.body;
            const event = await eventService.createEvent(groupId, title, description, eventDate, rewardPoints);

            res.status(201).json({
                success: true,
                data: event
            });
        } catch (error) {
            logger.error('Event creation failed', { error: error.message });
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
);

/**
 * POST /api/events/:eventId/participate
 * Participate in an event to earn points
 */
router.post(
    '/:eventId/participate',
    [
        param('eventId').isUUID(),
        body('walletId').isUUID()
    ],
    validate,
    async (req, res) => {
        try {
            const { eventId } = req.params;
            const { walletId } = req.body;

            const result = await eventService.participate(eventId, walletId);

            res.json({
                success: true,
                data: result
            });
        } catch (error) {
            res.status(400).json({ // 400 because usually it's "already participated" or logic error
                success: false,
                error: error.message
            });
        }
    }
);

module.exports = router;
