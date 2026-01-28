/**
 * Events Routes
 * API endpoints for event management
 */

const express = require('express');
const router = express.Router();
const eventService = require('../services/event.service');
const { requireAuth, requireAdmin } = require('../middleware/auth.middleware');
const logger = require('../config/logger');

/**
 * GET /api/events
 * Get all events (public or filtered)
 */
router.get('/', async (req, res) => {
    try {
        const { groupId, status } = req.query;
        const filters = {};

        if (groupId) filters.groupId = groupId;
        if (status) filters.status = status;

        // Use getUpcomingEvents for default list (OPEN/FULL events)
        const events = Object.keys(filters).length > 0
            ? await eventService.getEvents(filters)
            : await eventService.getUpcomingEvents();

        res.json({ success: true, data: events });
    } catch (error) {
        logger.error('Error fetching events:', error);
        res.status(500).json({ error: 'Failed to fetch events' });
    }
});

/**
 * GET /api/events/pending
 * Get all pending participations (admin only)
 */
router.get('/pending', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { groupId } = req.query;
        const pending = await eventService.getPendingParticipations(groupId);
        res.json({ success: true, data: pending });
    } catch (error) {
        logger.error('Error fetching pending participations:', error);
        res.status(500).json({ error: 'Failed to fetch pending participations' });
    }
});

/**
 * GET /api/events/:id
 * Get single event details
 */
router.get('/:id', async (req, res) => {
    try {
        const event = await eventService.getEvent(req.params.id);

        if (!event) {
            return res.status(404).json({ error: 'Event not found' });
        }

        res.json({ success: true, data: event });
    } catch (error) {
        logger.error('Error fetching event:', error);
        res.status(500).json({ error: 'Failed to fetch event' });
    }
});

/**
 * POST /api/events
 * Create a new event (admin only)
 */
router.post('/', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { groupId, title, description, eventDate, rewardPoints, maxParticipants, status } = req.body;

        // Validation
        if (!groupId || !title || !eventDate) {
            return res.status(400).json({
                error: 'Missing required fields',
                required: ['groupId', 'title', 'eventDate']
            });
        }

        const event = await eventService.createEvent(
            req.user.user_id,
            groupId,
            title,
            description,
            eventDate,
            rewardPoints || 0,
            maxParticipants || null,
            status || 'DRAFT'
        );

        res.status(201).json({
            success: true,
            message: 'Event created successfully',
            event
        });
    } catch (error) {
        logger.error('Error creating event:', error);
        res.status(500).json({ error: 'Failed to create event' });
    }
});

/**
 * PATCH /api/events/:id/status
 * Update event status (admin only)
 */
router.patch('/:id/status', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { status } = req.body;

        if (!status) {
            return res.status(400).json({ error: 'Status is required' });
        }

        const event = await eventService.updateEventStatus(req.params.id, status);

        res.json({
            success: true,
            message: `Event status updated to ${status}`,
            event
        });
    } catch (error) {
        logger.error('Error updating event status:', error);
        res.status(400).json({ error: error.message });
    }
});

/**
 * DELETE /api/events/:id
 * Delete an event (admin only)
 */
router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
    try {
        await eventService.deleteEvent(req.params.id);

        res.json({
            success: true,
            message: 'Event deleted successfully'
        });
    } catch (error) {
        logger.error('Error deleting event:', error);
        res.status(500).json({ error: 'Failed to delete event' });
    }
});

/**
 * POST /api/events/:id/participate
 * Register user for an event
 */
router.post('/:id/participate', requireAuth, async (req, res) => {
    try {
        const userId = req.user.user_id;
        const eventId = req.params.id;

        // Get user's wallet
        const { supabase } = require('../config/database');
        const { data: wallets } = await supabase
            .from('wallets')
            .select('wallet_id')
            .eq('user_id', userId)
            .eq('currency', 'CREDITS')
            .limit(1);

        if (!wallets || wallets.length === 0) {
            return res.status(404).json({ error: 'Wallet not found' });
        }

        const walletId = wallets[0].wallet_id;
        const participation = await eventService.participate(eventId, walletId);

        res.json({
            success: true,
            message: 'Successfully registered for the event',
            participation
        });
    } catch (error) {
        logger.error('Error participating in event:', error);
        res.status(400).json({ error: error.message });
    }
});

/**
 * DELETE /api/events/:id/participate
 * Cancel participation in an event
 */
router.delete('/:id/participate', requireAuth, async (req, res) => {
    try {
        const userId = req.user.user_id;
        const eventId = req.params.id;

        // Get user's wallet
        const { supabase } = require('../config/database');
        const { data: wallets } = await supabase
            .from('wallets')
            .select('wallet_id')
            .eq('user_id', userId)
            .eq('currency', 'CREDITS')
            .limit(1);

        if (!wallets || wallets.length === 0) {
            return res.status(404).json({ error: 'Wallet not found' });
        }

        const walletId = wallets[0].wallet_id;
        await eventService.cancelParticipation(eventId, walletId);

        res.json({
            success: true,
            message: 'Participation cancelled'
        });
    } catch (error) {
        logger.error('Error cancelling participation:', error);
        res.status(400).json({ error: error.message });
    }
});

/**
 * GET /api/events/:id/participants
 * Get list of participants for an event
 */
router.get('/:id/participants', requireAuth, async (req, res) => {
    try {
        const participants = await eventService.getEventParticipants(req.params.id);
        res.json({ success: true, data: participants });
    } catch (error) {
        logger.error('Error fetching participants:', error);
        res.status(500).json({ error: 'Failed to fetch participants' });
    }
});

/**
 * GET /api/events/:id/is-participating
 * Check if current user is participating
 */
router.get('/:id/is-participating', requireAuth, async (req, res) => {
    try {
        const isParticipating = await eventService.isUserParticipating(
            req.user.user_id,
            req.params.id
        );

        res.json({ isParticipating });
    } catch (error) {
        logger.error('Error checking participation:', error);
        res.status(500).json({ error: 'Failed to check participation' });
    }
});

/**
 * POST /api/events/participants/:id/validate
 * Validate or Reject user participation (admin only)
 */
router.post('/participants/:id/validate', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { status } = req.body;
        const participantId = req.params.id;

        if (!status) {
            return res.status(400).json({ error: 'Status is required' });
        }

        const result = await eventService.validateParticipation(participantId, status);

        res.json({
            success: true,
            message: `Participation ${status}`,
            result
        });
    } catch (error) {
        logger.error('Error validating participation:', error);
        res.status(400).json({ error: error.message });
    }
});

module.exports = router;
