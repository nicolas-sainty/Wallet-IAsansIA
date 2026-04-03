const { v4: uuidv4 } = require('uuid');
const Event = require('../../../../core/domain/entities/Event');

/**
 * Implémentation Supabase du repository des événements
 */
class SupabaseEventRepository {
    constructor(supabaseClient) {
        this.supabase = supabaseClient;
    }

    async findAll(filters = {}) {
        let query = this.supabase.from('events').select('*');

        if (filters.groupId) query = query.eq('group_id', filters.groupId);
        if (filters.status) query = query.eq('status', filters.status);

        const { data, error } = await query;
        if (error) throw error;
        return (data || []).map(e => new Event(e));
    }

    async findById(eventId) {
        const { data, error } = await this.supabase
            .from('events')
            .select('*')
            .eq('event_id', eventId)
            .maybeSingle();

        if (error || !data) return null;
        return new Event(data);
    }

    async findUpcoming() {
        const { data, error } = await this.supabase
            .from('events')
            .select('*')
            .in('status', ['OPEN', 'FULL'])
            .order('event_date', { ascending: true });

        if (error) throw error;
        return (data || []).map(e => new Event(e));
    }

    async create(eventData) {
        const { data, error } = await this.supabase
            .from('events')
            .insert({
                event_id: eventData.eventId,
                group_id: eventData.groupId,
                creator_user_id: eventData.creatorUserId,
                title: eventData.title,
                description: eventData.description,
                event_date: eventData.eventDate,
                reward_points: eventData.rewardPoints,
                max_participants: eventData.maxParticipants,
                status: eventData.status
            })
            .select()
            .single();

        if (error) throw error;
        return new Event(data);
    }

    async save(event) {
        const { data, error } = await this.supabase
            .from('events')
            .update({
                title: event.title,
                description: event.description,
                status: event.status,
                event_date: event.eventDate,
                reward_points: event.rewardPoints,
                max_participants: event.maxParticipants
            })
            .eq('event_id', event.eventId)
            .select()
            .single();

        if (error) throw error;
        return new Event(data);
    }

    async delete(eventId) {
        const { error } = await this.supabase
            .from('events')
            .delete()
            .eq('event_id', eventId);
        
        if (error) throw error;
        return true;
    }

    // Participations
    async findParticipants(eventId) {
        // Step 1: Get participants and their wallet's user_id
        const { data: participants, error: partError } = await this.supabase
            .from('event_participants')
            .select(`
                participant_id,
                wallet_id,
                status,
                participated_at,
                wallets (
                    user_id
                )
            `)
            .eq('event_id', eventId);

        if (partError) throw partError;
        if (!participants || participants.length === 0) return [];

        // Step 2: Get User details
        const userIds = participants.map(p => p.wallets?.user_id).filter(id => id);
        
        let userMap = {};
        if (userIds.length > 0) {
            const { data: users, error: userError } = await this.supabase
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

        // Step 3: Merge and format
        return participants.map(p => {
            const userId = p.wallets?.user_id;
            const user = userMap[userId] || {};
            return {
                participant_id: p.participant_id,
                wallet_id: p.wallet_id,
                user_id: userId,
                full_name: user.full_name || 'Inconnu',
                email: user.email || 'Inconnu',
                status: p.status,
                participated_at: p.participated_at
            };
        });
    }

    async addParticipant(eventId, walletId, pointsEarned = 0) {
        const { data, error } = await this.supabase
            .from('event_participants')
            .insert({
                participant_id: uuidv4(),
                event_id: eventId,
                wallet_id: walletId,
                points_earned: pointsEarned,
                status: 'PENDING'
            })
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    async removeParticipant(eventId, walletId) {
        const { error } = await this.supabase
            .from('event_participants')
            .delete()
            .eq('event_id', eventId)
            .eq('wallet_id', walletId);

        if (error) throw error;
        return true;
    }

    async isParticipating(userId, eventId) {
        const { data, error } = await this.supabase
            .from('event_participants')
            .select('participant_id, wallets!inner(user_id)')
            .eq('event_id', eventId)
            .eq('wallets.user_id', userId)
            .maybeSingle();

        if (error) return false;
        return !!data;
    }

    async findPendingParticipations(filters = {}) {
        let query = this.supabase
            .from('event_participants')
            .select(`
                participant_id,
                status,
                participated_at,
                event:events (title, event_date, bde_group_id:group_id),
                wallets (
                    user_id
                )
            `)
            .eq('status', 'PENDING');

        if (filters.bdeId) {
            query = query.eq('events.group_id', filters.bdeId);
        }

        const { data: participations, error } = await query;
        if (error) throw error;
        if (!participations || participations.length === 0) return [];

        // Fetch User details in a second step
        const userIds = participations.map(p => p.wallets?.user_id).filter(id => id);
        let userMap = {};
        if (userIds.length > 0) {
            const { data: users, error: userError } = await this.supabase
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

        // Flatten for frontend
        return participations.map(p => {
            const userId = p.wallets?.user_id;
            const user = userMap[userId] || {};
            return {
                participant_id: p.participant_id,
                status: p.status,
                participated_at: p.participated_at,
                event_title: p.event?.title,
                event_date: p.event?.event_date,
                full_name: user.full_name || 'Inconnu',
                email: user.email || 'Inconnu'
            };
        });
    }

    async findParticipationById(participantId) {
        const { data, error } = await this.supabase
            .from('event_participants')
            .select('*')
            .eq('participant_id', participantId)
            .maybeSingle();
        
        if (error) throw error;
        return data;
    }

    async updateParticipationStatus(participantId, status) {
        const { data, error } = await this.supabase
            .from('event_participants')
            .update({ status, updated_at: new Date().toISOString() })
            .eq('participant_id', participantId)
            .select()
            .single();
        
        if (error) throw error;
        return data;
    }
}

module.exports = SupabaseEventRepository;
