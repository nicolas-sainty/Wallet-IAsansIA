const User = require('../../../../core/domain/entities/User');

/**
 * Implémentation Supabase du repository des utilisateurs
 */
class SupabaseUserRepository {
    constructor(supabaseClient) {
        this.supabase = supabaseClient;
    }

    async findById(userId) {
        const { data, error } = await this.supabase
            .from('users')
            .select('*')
            .eq('user_id', userId)
            .maybeSingle();

        if (error || !data) return null;
        return new User(data);
    }

    async findByEmail(email) {
        const { data, error } = await this.supabase
            .from('users')
            .select('*')
            .eq('email', email)
            .maybeSingle();

        if (error || !data) return null;
        return new User(data);
    }

    async findByVerificationToken(token) {
        const { data, error } = await this.supabase
            .from('users')
            .select('*')
            .eq('verification_token', token)
            .maybeSingle();

        if (error || !data) return null;
        return new User(data);
    }

    async exists(email) {
        const { data, error } = await this.supabase
            .from('users')
            .select('user_id')
            .eq('email', email)
            .maybeSingle();

        if (error) return false;
        return !!data;
    }

    async save(user) {
        const { data, error } = await this.supabase
            .from('users')
            .update({
                email: user.email,
                password_hash: user.passwordHash,
                full_name: user.fullName,
                role: user.role,
                bde_id: user.bdeId,
                is_verified: user.isVerified,
                verification_token: user.verificationToken
            })
            .eq('user_id', user.userId)
            .select()
            .single();

        if (error) throw error;
        return new User(data);
    }

    async create(userData) {
        const { data, error } = await this.supabase
            .from('users')
            .insert({
                user_id: userData.userId,
                email: userData.email,
                password_hash: userData.passwordHash,
                full_name: userData.fullName,
                role: userData.role,
                bde_id: userData.bdeId,
                is_verified: userData.isVerified,
                verification_token: userData.verificationToken
            })
            .select()
            .single();

        if (error) throw error;
        return new User(data);
    }
}

module.exports = SupabaseUserRepository;
