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
    async createEvent(groupId, title, description, eventDate, rewardPoints) {
        const eventId = uuidv4();

        try {
            await db.query(
                `INSERT INTO events (event_id, group_id, title, description, event_date, reward_points) 
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [eventId, groupId, title, description, eventDate, rewardPoints]
            );

            logger.info(`Event created: ${title} (${eventId})`);
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
                `SELECT e.*, g.group_name 
                 FROM events e 
                 JOIN groups g ON e.group_id = g.group_id
                 WHERE e.status = 'upcoming' OR e.status = 'active'
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
        const { rows } = await db.query('SELECT * FROM events WHERE event_id = $1', [eventId]);
        return rows[0];
    }

    /**
     * Participate in an event
     * This adds the user to participants and credits their wallet
     */
    async participate(eventId, walletId) {
        const event = await this.getEvent(eventId);
        if (!event) throw new Error('Event not found');

        // Check if already participated
        const { rows } = await db.query(
            'SELECT * FROM event_participants WHERE event_id = $1 AND wallet_id = $2',
            [eventId, walletId]
        );

        if (rows.length > 0) {
            throw new Error('Wallet has already participated in this event');
        }

        const participantId = uuidv4();

        // Transaction to ensure atomicity
        return await db.transaction(async (client) => {
            // 1. Record participation as PENDING
            const result = await client.query(
                `INSERT INTO event_participants (participant_id, event_id, wallet_id, points_earned, status)
                 VALUES ($1, $2, $3, $4, 'pending')
                 RETURNING *`,
                [participantId, eventId, walletId, event.reward_points]
            );

            logger.info(`Participation recorded (PENDING): Event ${eventId}, Wallet ${walletId}, Points ${event.reward_points}`);

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
}

module.exports = new EventService();
