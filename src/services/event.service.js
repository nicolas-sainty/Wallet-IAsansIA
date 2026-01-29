const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const logger = require('../config/logger');
<<<<<<< HEAD

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
=======
const { supabase } = require('../config/database');
>>>>>>> fix-detached-head

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
<<<<<<< HEAD
            await runQuery(
                `INSERT INTO events (event_id, group_id, title, description, event_date, reward_points) 
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [eventId, groupId, title, description, eventDate, rewardPoints]
            );
=======
            const { error } = await supabase
                .from('events')
                .insert({
                    event_id: eventId,
                    group_id: groupId,
                    title,
                    description,
                    event_date: eventDate,
                    reward_points: rewardPoints,
                    max_participants: maxParticipants,
                    status,
                    created_by_user_id: userId,
                    current_participants: 0
                });

            if (error) throw error;
>>>>>>> fix-detached-head

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
<<<<<<< HEAD
            return await allQuery(
                `SELECT e.*, g.group_name 
                 FROM events e 
                 JOIN groups g ON e.group_id = g.group_id
                 WHERE e.status = 'upcoming' OR e.status = 'active'
                 ORDER BY e.event_date ASC`
            );
=======
            const { data, error } = await supabase
                .from('events')
                .select(`
                    *,
                    groups:group_id (group_name),
                    users:created_by_user_id (full_name)
                `)
                .in('status', ['OPEN', 'FULL'])
                .order('event_date', { ascending: true });

            if (error) throw error;

            return (data || []).map(event => ({
                ...event,
                group_name: event.groups?.group_name || null,
                creator_name: event.users?.full_name || null
            }));
>>>>>>> fix-detached-head
        } catch (error) {
            logger.error('Error fetching events:', error);
            throw error;
        }
    }

    /**
     * Get event details
     */
    async getEvent(eventId) {
<<<<<<< HEAD
        return await getQuery('SELECT * FROM events WHERE event_id = ?', [eventId]);
=======
        const { data, error } = await supabase
            .from('events')
            .select(`
                *,
                groups:group_id (group_name),
                users:created_by_user_id (full_name)
            `)
            .eq('event_id', eventId)
            .single();

        if (error) {
            logger.error('Error fetching event:', error);
            return null;
        }

        return {
            ...data,
            group_name: data.groups?.group_name || null,
            creator_name: data.users?.full_name || null
        };
>>>>>>> fix-detached-head
    }

    /**
     * Participate in an event
     * This adds the user to participants and credits their wallet
     */
    async participate(eventId, walletId) {
        const event = await this.getEvent(eventId);
        if (!event) throw new Error('Event not found');

        // Check if already participated
<<<<<<< HEAD
        const existing = await getQuery(
            'SELECT * FROM event_participants WHERE event_id = ? AND wallet_id = ?',
            [eventId, walletId]
        );

        if (existing) {
            throw new Error('Wallet has already participated in this event');
=======
        const { data: existing } = await supabase
            .from('event_participants')
            .select('*')
            .eq('event_id', eventId)
            .eq('wallet_id', walletId);

        if (existing && existing.length > 0) {
            throw new Error('Already registered for this event');
>>>>>>> fix-detached-head
        }

        const participantId = uuidv4();

<<<<<<< HEAD
        // Transaction to ensure atomicity (SQLite serialized mode handles this mostly, but good practice)
        // 1. Record participation
        // 1. Record participation with PENDING status
        await runQuery(
            `INSERT INTO event_participants (participant_id, event_id, wallet_id, points_earned, status)
             VALUES (?, ?, ?, ?, 'PENDING')`,
            [participantId, eventId, walletId, event.reward_points]
        );

        // 2. DO NOT Credit wallet yet - Wait for BDE validation
        // await runQuery(
        //     `UPDATE wallets SET balance = balance + ? WHERE wallet_id = ?`,
        //     [event.reward_points, walletId]
        // );

        logger.info(`Participation recorded (PENDING): Event ${eventId}, Wallet ${walletId}, Points ${event.reward_points}`);

        return {
            participantId,
            status: 'PENDING',
            pointsEarned: event.reward_points
        };
=======
        // NOTE: Supabase doesn't support transactions via JS client
        // This is a simplified version - ideally use an RPC function
        try {
            // Record participation as pending
            const { data, error } = await supabase
                .from('event_participants')
                .insert({
                    participant_id: participantId,
                    event_id: eventId,
                    wallet_id: walletId,
                    points_earned: event.reward_points,
                    status: 'pending'
                })
                .select()
                .single();

            if (error) throw error;

            // Update current_participants count
            await supabase
                .from('events')
                .update({
                    current_participants: event.current_participants + 1
                })
                .eq('event_id', eventId);

            logger.info(`Participation registered: Event ${eventId}, Wallet ${walletId}`);

            return data;
        } catch (error) {
            logger.error('Error registering participation:', error);
            throw error;
        }
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

        try {
            // 1. Get participation details
            const { data: participation, error: fetchError } = await supabase
                .from('event_participants')
                .select('*')
                .eq('participant_id', participantId)
                .single();

            if (fetchError || !participation) throw new Error('Participation not found');
            if (participation.status !== 'pending') throw new Error('Participation already processed');

            // 2. Update status
            await supabase
                .from('event_participants')
                .update({ status })
                .eq('participant_id', participantId);

            // 3. If verified, credit wallet
            if (status === 'verified') {
                const { data: wallet } = await supabase
                    .from('wallets')
                    .select('balance')
                    .eq('wallet_id', participation.wallet_id)
                    .single();

                if (wallet) {
                    const newBalance = parseFloat(wallet.balance) + parseFloat(participation.points_earned);
                    await supabase
                        .from('wallets')
                        .update({ balance: newBalance })
                        .eq('wallet_id', participation.wallet_id);

                    // 4. Create Transaction Record
                    const { v4: uuidv4 } = require('uuid');
                    await supabase
                        .from('transactions')
                        .insert({
                            transaction_id: uuidv4(),
                            initiator_user_id: null, // System/Admin action
                            source_wallet_id: null, // Minting/System
                            destination_wallet_id: participation.wallet_id,
                            amount: parseFloat(participation.points_earned),
                            currency: 'CREDITS',
                            status: 'SUCCESS',
                            type: 'REWARD',
                            description: `Gain événement: Event ${participation.event_id}`,
                            created_at: new Date().toISOString(),
                            executed_at: new Date().toISOString()
                        });
                }
            }


            return { success: true, status };
        } catch (error) {
            logger.error('Error validating participation:', error);
            throw error;
        }
    }

    /**
     * Get pending participations for a group (or all if groupId is null)
     */
    async getPendingParticipations(groupId = null) {
        try {
            // Step 1: Fetch pending participations with Event details and Wallet User ID
            const { data, error } = await supabase
                .from('event_participants')
                .select(`
                    *,
                    events (title, group_id),
                    wallets (user_id)
                `)
                .eq('status', 'pending')
                .order('participated_at', { ascending: false });

            if (error) throw error;
            if (!data || data.length === 0) return [];

            // Step 2: Extract User IDs
            const userIds = data
                .map(ep => ep.wallets?.user_id)
                .filter(id => id);

            // Step 3: Fetch Users
            let userMap = {};
            if (userIds.length > 0) {
                const { data: users, error: userError } = await supabase
                    .from('users')
                    .select('user_id, full_name, email')
                    .in('user_id', userIds);

                if (!userError && users) {
                    userMap = users.reduce((acc, u) => {
                        acc[u.user_id] = u;
                        return acc;
                    }, {});
                }
            }

            // Step 4: Merge Data
            let results = data.map(ep => {
                const userId = ep.wallets?.user_id;
                const user = userMap[userId] || {};

                return {
                    ...ep,
                    event_title: ep.events?.title || null,
                    event_group_id: ep.events?.group_id || null,
                    user_name: user.full_name || 'Unknown',
                    user_email: user.email || 'Unknown'
                };
            });

            // Filter by group if specified
            if (groupId) {
                results = results.filter(r => r.event_group_id === groupId);
            }

            return results;
        } catch (error) {
            logger.error('Error fetching pending participations:', error);
            throw error;
        }
    }

    /**
     * Update event status (admin only)
     */
    async updateEventStatus(eventId, newStatus) {
        const validStatuses = ['DRAFT', 'OPEN', 'FULL', 'CLOSED', 'CANCELLED'];
        if (!validStatuses.includes(newStatus)) {
            throw new Error(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
        }

        const { data, error } = await supabase
            .from('events')
            .update({ status: newStatus })
            .eq('event_id', eventId)
            .select()
            .single();

        if (error || !data) {
            throw new Error('Event not found');
        }

        logger.info(`Event ${eventId} status updated to ${newStatus}`);
        return data;
    }

    /**
     * Delete event (admin only)
     */
    async deleteEvent(eventId) {
        const { data, error } = await supabase
            .from('events')
            .delete()
            .eq('event_id', eventId)
            .select()
            .single();

        if (error || !data) {
            throw new Error('Event not found');
        }

        logger.info(`Event ${eventId} deleted`);
        return data;
    }

    /**
     * Cancel participation
     */
    async cancelParticipation(eventId, walletId) {
        const { data, error } = await supabase
            .from('event_participants')
            .delete()
            .eq('event_id', eventId)
            .eq('wallet_id', walletId)
            .select()
            .single();

        if (error || !data) {
            throw new Error('Participation not found');
        }

        logger.info(`Participation cancelled: Event ${eventId}, Wallet ${walletId}`);
        return data;
    }

    /**
     * Get participants for an event
     */
    async getEventParticipants(eventId) {
        // Step 1: Get participants and their wallet IDs
        const { data: participants, error: partError } = await supabase
            .from('event_participants')
            .select(`
                *,
                wallets (
                    wallet_id,
                    user_id
                )
            `)
            .eq('event_id', eventId)
            .order('participated_at', { ascending: false });

        if (partError) {
            logger.error('Error fetching participants:', partError);
            throw partError;
        }

        if (!participants || participants.length === 0) {
            return [];
        }

        // Step 2: Get all User IDs
        const userIds = participants
            .map(p => p.wallets?.user_id)
            .filter(id => id); // Remove nulls

        if (userIds.length === 0) {
            return participants.map(p => ({
                ...p,
                user_id: null,
                full_name: 'Unknown',
                email: 'Unknown'
            }));
        }

        // Step 3: Fetch Users
        const { data: users, error: userError } = await supabase
            .from('users')
            .select('user_id, full_name, email')
            .in('user_id', userIds);

        if (userError) {
            logger.error('Error fetching participant users:', userError);
            // Don't throw, just return without user details
        }

        // Step 4: Map users back to participants
        const userMap = (users || []).reduce((acc, user) => {
            acc[user.user_id] = user;
            return acc;
        }, {});

        return participants.map(ep => {
            const userId = ep.wallets?.user_id;
            const user = userMap[userId] || {};

            return {
                ...ep,
                user_id: userId,
                full_name: user.full_name || 'Unknown',
                email: user.email || 'Unknown'
            };
        });
    }

    /**
     * Check if user is participating
     */
    async isUserParticipating(userId, eventId) {
        const { data, error } = await supabase
            .from('event_participants')
            .select(`
                *,
                wallets:wallet_id (user_id)
            `)
            .eq('event_id', eventId);

        if (error) return false;

        return (data || []).some(ep => ep.wallets?.user_id === userId);
>>>>>>> fix-detached-head
    }
}

module.exports = new EventService();
