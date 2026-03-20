const { v4: uuidv4 } = require('uuid');

/**
 * Use Case: Créer un nouveau groupe (BDE)
 */
class CreateGroup {
    constructor(groupRepository, logger) {
        this.groupRepository = groupRepository;
        this.logger = logger;
    }

    async execute({ groupName, adminUserId, settings }) {
        const groupId = uuidv4();
        const groupData = {
            groupId,
            groupName,
            adminUserId,
            settings: settings || {},
            status: 'active'
        };

        const group = await this.groupRepository.create(groupData);
        this.logger.info('Groupe créé (Architecture Hexagonale)', { groupId, groupName });
        return group;
    }
}

module.exports = CreateGroup;
