const Group = require('../../../../core/domain/entities/Group');

/**
 * Implémentation Supabase du repository des groupes
 */
class SupabaseGroupRepository {
    constructor(supabaseClient) {
        this.supabase = supabaseClient;
    }

    async findAll() {
        const { data, error } = await this.supabase
            .from('groups')
            .select('*');

        if (error) throw error;
        return (data || []).map(g => new Group(g));
    }

    async findById(groupId) {
        const { data, error } = await this.supabase
            .from('groups')
            .select('*')
            .eq('group_id', groupId)
            .maybeSingle();

        if (error || !data) return null;
        return new Group(data);
    }

    async create(groupData) {
        const { data, error } = await this.supabase
            .from('groups')
            .insert({
                group_id: groupData.groupId,
                group_name: groupData.groupName,
                admin_user_id: groupData.adminUserId,
                settings: groupData.settings,
                status: groupData.status
            })
            .select()
            .single();

        if (error) throw error;
        return new Group(data);
    }

    async save(group) {
        const { data, error } = await this.supabase
            .from('groups')
            .update({
                group_name: group.groupName,
                settings: group.settings,
                status: group.status,
                updated_at: new Date().toISOString()
            })
            .eq('group_id', group.groupId)
            .select()
            .single();

        if (error) throw error;
        return new Group(data);
    }
}

module.exports = SupabaseGroupRepository;
