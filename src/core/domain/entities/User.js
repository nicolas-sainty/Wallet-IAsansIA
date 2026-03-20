class User {
    constructor({ user_id, email, password_hash, full_name, role, bde_id, is_verified, verification_token, created_at }) {
        this.userId = user_id;
        this.email = email;
        this.passwordHash = password_hash;
        this.fullName = full_name;
        this.role = role || 'student';
        this.bdeId = bde_id;
        this.isVerified = is_verified || false;
        this.verificationToken = verification_token;
        this.createdAt = created_at;
    }

    verify() {
        this.isVerified = true;
        this.verificationToken = null;
    }

    isStudent() {
        return this.role === 'student';
    }

    isAdmin() {
        return this.role === 'admin';
    }
}

module.exports = User;
