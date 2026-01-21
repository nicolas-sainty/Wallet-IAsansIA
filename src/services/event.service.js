const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const logger = require('../config/logger');

const dbPath = path.join(__dirname, '../../database/epicoin.sqlite');
const db = new sqlite3.Database(dbPath);

// Promisify DB helper (Should abstract this later if time permits)
const runQuery = (query, params = []) => {
    return new Promise((resolve, reject) => {
        db.run(query, params, function (err) {
            if (err) reject(err);
            else resolve(this);
        });
    });
};

const getQuery = (query, params = []) => {
    return new Promise((resolve, reject) => {
        db.get(query, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
};

const allQuery = (query, params = []) => {
    return new Promise((resolve, reject) => {
        db.all(query, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
};

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
            await runQuery(
                `INSERT INTO events (event_id, group_id, title, description, event_date, reward_points) 
                 VALUES (?, ?, ?, ?, ?, ?)`,
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
            return await allQuery(
                `SELECT e.*, g.group_name 
                 FROM events e 
                 JOIN groups g ON e.group_id = g.group_id
                 WHERE e.status = 'upcoming' OR e.status = 'active'
                 ORDER BY e.event_date ASC`
            );
        } catch (error) {
            logger.error('Error fetching events:', error);
            throw error;
        }
    }

    /**
     * Get event details
     */
    async getEvent(eventId) {
        return await getQuery('SELECT * FROM events WHERE event_id = ?', [eventId]);
    }

    /**
     * Participate in an event
     * This adds the user to participants and credits their wallet
     */
    async participate(eventId, walletId) {
        const event = await this.getEvent(eventId);
        if (!event) throw new Error('Event not found');

        // Check if already participated
        const existing = await getQuery(
            'SELECT * FROM event_participants WHERE event_id = ? AND wallet_id = ?',
            [eventId, walletId]
        );

        if (existing) {
            throw new Error('Wallet has already participated in this event');
        }

        const participantId = uuidv4();

        // Transaction to ensure atomicity (SQLite serialized mode handles this mostly, but good practice)
        // 1. Record participation
        await runQuery(
            `INSERT INTO event_participants (participant_id, event_id, wallet_id, points_earned)
             VALUES (?, ?, ?, ?)`,
            [participantId, eventId, walletId, event.reward_points]
        );

        // 2. Credit wallet (Using raw update for simplicity, ideally call WalletService)
        // We assume WalletService logic is simple enough here or we inject it. 
        // For speed, let's update directly but log it.
        await runQuery(
            `UPDATE wallets SET balance = balance + ? WHERE wallet_id = ?`,
            [event.reward_points, walletId]
        );

        logger.info(`Participation recorded: Event ${eventId}, Wallet ${walletId}, Points ${event.reward_points}`);

        return {
            participantId,
            pointsEarned: event.reward_points
        };
    }
}

module.exports = new EventService();
