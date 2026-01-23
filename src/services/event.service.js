const { v4: uuidv4 } = require('uuid');
const logger = require('../config/logger');
const db = require('../config/database');

/**
 * Event Service
 * Handles business logic for BDE events
 */
class EventService {
    /**
     * Create a new event
     */
    async createEvent(userId, groupId, title, description, eventDate, rewardPoints, maxParticipants = null, status = 'DRAFT') {
        const eventId = uuidv4();

        try {
            await db.query(
                `INSERT INTO events (event_id, group_id, title, description, event_date, reward_points, max_participants, status, created_by_user_id, current_participants) 
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 0)`,
                [eventId, groupId, title, description, eventDate, rewardPoints, maxParticipants, status, userId]
            );

            logger.info(`Event created: ${title} (${eventId}) by user ${userId}`);
            return this.getEvent(eventId);
        } catch (error) {
            logger.error('Error creating event:', error);
            throw error;
        }
    }

    /**
     * Get all upcoming events
     */
    async getUpcomingEvents() {
        try {
            const { rows } = await db.query(
                `SELECT e.*, g.group_name, u.full_name as creator_name,
                        e.current_participants, e.max_participants
                 FROM events e 
                 LEFT JOIN groups g ON e.group_id = g.group_id
                 LEFT JOIN users u ON e.created_by_user_id = u.user_id
                 WHERE e.status IN ('OPEN', 'FULL')
                 ORDER BY e.event_date ASC`
            );
            return rows;
        } catch (error) {
            logger.error('Error fetching events:', error);
            throw error;
        }
    }

    /**
     * Get event details
     */
    async getEvent(eventId) {
        const { rows } = await db.query(
            `SELECT e.*, g.group_name, u.full_name as creator_name,
                    e.current_participants, e.max_participants
             FROM events e
             LEFT JOIN groups g ON e.group_id = g.group_id
             LEFT JOIN users u ON e.created_by_user_id = u.user_id
             WHERE e.event_id = $1`,
            [eventId]
        );
        return rows[0];
    }

    /**
     * Participate in an event
     * This adds the user to participants and credits their wallet
     */
    async participate(eventId, walletId) {
        const event = await this.getEvent(eventId);
        if (!event) throw new Error('Event not found');

        // Check event status
        if (event.status === 'FULL') {
            throw new Error('Event is full');
        }
        if (event.status !== 'OPEN') {
            throw new Error('Event is not open for registration');
        }

        // Check if already participated
        const { rows } = await db.query(
            'SELECT * FROM event_participants WHERE event_id = $1 AND wallet_id = $2',
            [eventId, walletId]
        );

        if (rows.length > 0) {
            throw new Error('Already registered for this event');
        }

        const participantId = uuidv4();

        // Transaction to ensure atomicity
        return await db.transaction(async (client) => {
            // Record participation as registered
            const result = await client.query(
                `INSERT INTO event_participants (participant_id, event_id, wallet_id, points_earned, status)
                 VALUES ($1, $2, $3, $4, 'registered')
                 RETURNING *`,
                [participantId, eventId, walletId, event.reward_points]
            );

            // Trigger will auto-update current_participants and status to FULL if needed

            logger.info(`Participation registered: Event ${eventId}, Wallet ${walletId}`);

            return result.rows[0];
        });
    }

    /**
     * Validate or Reject participation
     * @param {string} participantId
     * @param {string} status - 'verified' or 'rejected'
     */
    async validateParticipation(participantId, status) {
        if (!['verified', 'rejected'].includes(status)) {
            throw new Error('Invalid status. Must be verified or rejected');
        }

        return await db.transaction(async (client) => {
            // 1. Get participation details
            const { rows } = await client.query(
                'SELECT * FROM event_participants WHERE participant_id = $1',
                [participantId]
            );
            const participation = rows[0];

            if (!participation) throw new Error('Participation not found');
            if (participation.status !== 'pending') throw new Error('Participation already processed');

            // 2. Update status
            await client.query(
                'UPDATE event_participants SET status = $1 WHERE participant_id = $2',
                [status, participantId]
            );

            // 3. If verified, credit wallet
            if (status === 'verified') {
                await client.query(
                    'UPDATE wallets SET balance = balance + $1 WHERE wallet_id = $2',
                    [participation.points_earned, participation.wallet_id]
                );
            }

            return { success: true, status };
        });
    }

    /**
     * Get pending participations for a group (or all if groupId is null)
     */
    async getPendingParticipations(groupId = null) {
        let query = `
            SELECT ep.*, e.title as event_title, u.full_name as user_name, u.email as user_email
            FROM event_participants ep
            JOIN events e ON ep.event_id = e.event_id
            JOIN wallets w ON ep.wallet_id = w.wallet_id
            JOIN users u ON w.user_id = u.user_id
            WHERE ep.status = 'pending'
        `;
        const params = [];

        if (groupId) {
            query += ' AND e.group_id = $1';
            params.push(groupId);
        }

        query += ' ORDER BY ep.participated_at DESC';

        const { rows } = await db.query(query, params);
        return rows;
    }

    /**
     * Update event status (admin only)
     */
    async updateEventStatus(eventId, newStatus) {
        const validStatuses = ['DRAFT', 'OPEN', 'FULL', 'CLOSED', 'CANCELLED'];
        if (!validStatuses.includes(newStatus)) {
            throw new Error(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
        }

        const result = await db.query(
            'UPDATE events SET status = $1 WHERE event_id = $2 RETURNING *',
            [newStatus, eventId]
        );

        if (result.rows.length === 0) {
            throw new Error('Event not found');
        }

        logger.info(`Event ${eventId} status updated to ${newStatus}`);
        return result.rows[0];
    }

    /**
     * Delete event (admin only)
     */
    async deleteEvent(eventId) {
        const result = await db.query(
            'DELETE FROM events WHERE event_id = $1 RETURNING *',
            [eventId]
        );

        if (result.rows.length === 0) {
            throw new Error('Event not found');
        }

        logger.info(`Event ${eventId} deleted`);
        return result.rows[0];
    }

    /**
     * Cancel participation
     */
    async cancelParticipation(eventId, walletId) {
        const result = await db.query(
            'DELETE FROM event_participants WHERE event_id = $1 AND wallet_id = $2 RETURNING *',
            [eventId, walletId]
        );

        if (result.rows.length === 0) {
            throw new Error('Participation not found');
        }

        logger.info(`Participation cancelled: Event ${eventId}, Wallet ${walletId}`);
        return result.rows[0];
    }

    /**
     * Get participants for an event
     */
    async getEventParticipants(eventId) {
        const { rows } = await db.query(
            `SELECT ep.*, u.full_name, u.email, w.user_id
             FROM event_participants ep
             JOIN wallets w ON ep.wallet_id = w.wallet_id
             JOIN users u ON w.user_id = u.user_id
             WHERE ep.event_id = $1
             ORDER BY ep.participated_at DESC`,
            [eventId]
        );
        return rows;
    }

    /**
     * Check if user is participating
     */
    async isUserParticipating(userId, eventId) {
        const { rows } = await db.query(
            `SELECT ep.*
             FROM event_participants ep
             JOIN wallets w ON ep.wallet_id = w.wallet_id
             WHERE w.user_id = $1 AND ep.event_id = $2`,
            [userId, eventId]
        );
        return rows.length > 0;
    }
}

module.exports = new EventService();
