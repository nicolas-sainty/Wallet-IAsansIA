const { v4: uuidv4 } = require('uuid');
const logger = require('../config/logger');
const { supabase } = require('../config/database');

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
        } catch (error) {
            logger.error('Error fetching events:', error);
            throw error;
        }
    }

    /**
     * Get event details
     */
    async getEvent(eventId) {
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
        const { data: existing } = await supabase
            .from('event_participants')
            .select('*')
            .eq('event_id', eventId)
            .eq('wallet_id', walletId);

        if (existing && existing.length > 0) {
            throw new Error('Already registered for this event');
        }

        const participantId = uuidv4();

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
            let query = supabase
                .from('event_participants')
                .select(`
                    *,
                    events:event_id (title, group_id),
                    wallets:wallet_id (
                        user_id,
                        users:user_id (full_name, email)
                    )
                `)
                .eq('status', 'pending')
                .order('participated_at', { ascending: false });

            const { data, error } = await query;

            if (error) throw error;

            // Filter by group if specified and flatten
            let results = (data || []).map(ep => ({
                ...ep,
                event_title: ep.events?.title || null,
                event_group_id: ep.events?.group_id || null,
                user_name: ep.wallets?.users?.full_name || null,
                user_email: ep.wallets?.users?.email || null
            }));

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
        const { data, error } = await supabase
            .from('event_participants')
            .select(`
                *,
                wallets:wallet_id (
                    user_id,
                    users:user_id (full_name, email)
                )
            `)
            .eq('event_id', eventId)
            .order('participated_at', { ascending: false });

        if (error) {
            logger.error('Error fetching participants:', error);
            throw error;
        }

        return (data || []).map(ep => ({
            ...ep,
            user_id: ep.wallets?.user_id || null,
            full_name: ep.wallets?.users?.full_name || null,
            email: ep.wallets?.users?.email || null
        }));
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
    }
}

module.exports = new EventService();
