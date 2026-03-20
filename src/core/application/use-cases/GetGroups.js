/**
 * Use Case: Récupérer tous les groupes
 */
class GetGroups {
    constructor(groupRepository) {
        this.groupRepository = groupRepository;
    }

    async execute() {
        return this.groupRepository.findAll();
    }
}

module.exports = GetGroups;
