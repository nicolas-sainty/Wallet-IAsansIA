const User = require('../../../../../src/core/domain/entities/User');

describe('User Entity', () => {
    it('should create a User instance with correct properties', () => {
        const userData = {
            user_id: 'u1',
            email: 'test@test.com',
            password_hash: 'hash123',
            full_name: 'John Doe',
            role: 'admin',
            bde_id: 'bde1',
            is_verified: true,
            verification_token: 'tok123',
            created_at: '2024-01-01'
        };

        const user = new User(userData);

        expect(user.userId).toBe('u1');
        expect(user.email).toBe('test@test.com');
        expect(user.passwordHash).toBe('hash123');
        expect(user.fullName).toBe('John Doe');
        expect(user.role).toBe('admin');
        expect(user.bdeId).toBe('bde1');
        expect(user.isVerified).toBe(true);
        expect(user.verificationToken).toBe('tok123');
        expect(user.createdAt).toBe('2024-01-01');
    });

    it('should fallback to default values when not provided', () => {
        const user = new User({ user_id: 'u2' });
        expect(user.role).toBe('student');
        expect(user.isVerified).toBe(false);
    });

    it('verify() should set isVerified to true and clear verificationToken', () => {
        const user = new User({ verification_token: '123' });
        user.verify();
        expect(user.isVerified).toBe(true);
        expect(user.verificationToken).toBeNull();
    });

    it('isStudent() should return true when role is student', () => {
        const user = new User({ role: 'student' });
        expect(user.isStudent()).toBe(true);
    });

    it('isStudent() should return false when role is not student', () => {
        const user = new User({ role: 'admin' });
        expect(user.isStudent()).toBe(false);
    });

    it('isAdmin() should return true when role is admin', () => {
        const user = new User({ role: 'admin' });
        expect(user.isAdmin()).toBe(true);
    });

    it('isAdmin() should return false when role is not admin', () => {
        const user = new User({ role: 'student' });
        expect(user.isAdmin()).toBe(false);
    });
});
