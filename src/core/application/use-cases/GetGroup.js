/**
 * Cas d'utilisation: Récupérer un groupe par son ID
 */
class GetGroup {
    constructor(groupRepository) {
        this.groupRepository = groupRepository;
    }

    async execute(groupId) {
        return this.groupRepository.findById(groupId);
    }
}

module.exports = GetGroup;
