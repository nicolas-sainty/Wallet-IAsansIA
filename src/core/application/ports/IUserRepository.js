/**
 * Interface pour le repository des utilisateurs
 */
class IUserRepository {
    async findById(userId) { throw new Error('Method not implemented'); }
    async findByEmail(email) { throw new Error('Method not implemented'); }
    async findByVerificationToken(token) { throw new Error('Method not implemented'); }
    async exists(email) { throw new Error('Method not implemented'); }
    async save(user) { throw new Error('Method not implemented'); }
    async create(userData) { throw new Error('Method not implemented'); }
}

module.exports = IUserRepository;
