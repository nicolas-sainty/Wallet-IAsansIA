/**
 * Interface pour le repository des groupes
 */
class IGroupRepository {
    async findAll() { throw new Error('Not implemented'); }
    async findById(groupId) { throw new Error('Not implemented'); }
    async findByAdminId(adminUserId) { throw new Error('Not implemented'); }
    async create(groupData) { throw new Error('Not implemented'); }
    async save(group) { throw new Error('Not implemented'); }
}

module.exports = IGroupRepository;
