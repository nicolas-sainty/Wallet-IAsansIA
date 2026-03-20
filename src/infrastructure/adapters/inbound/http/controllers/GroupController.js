/**
 * Contrôleur Express pour les groupes (BDE)
 */
class GroupController {
    constructor(createGroupUseCase, getGroupsUseCase, getGroupUseCase) {
        this.createGroupUseCase = createGroupUseCase;
        this.getGroupsUseCase = getGroupsUseCase;
        this.getGroupUseCase = getGroupUseCase;
    }

    async create(req, res) {
        try {
            const { groupName, adminUserId, settings } = req.body;
            const group = await this.createGroupUseCase.execute({ groupName, adminUserId, settings });
            return res.status(201).json({ success: true, group });
        } catch (error) {
            return res.status(400).json({ success: false, error: error.message });
        }
    }

    async getAll(req, res) {
        try {
            const groups = await this.getGroupsUseCase.execute();
            const data = groups.map(g => ({
                group_id: g.groupId,
                group_name: g.name,
                group_type: g.type,
                status: g.status,
                created_at: g.createdAt
            }));
            return res.json({ success: true, data });
        } catch (error) {
            return res.status(500).json({ success: false, error: error.message });
        }
    }

    async getById(req, res) {
        try {
            const { groupId } = req.params;
            const group = await this.getGroupUseCase.execute(groupId);
            if (!group) return res.status(404).json({ success: false, error: 'Group not found' });
            
            const data = {
                group_id: group.groupId,
                group_name: group.name,
                group_type: group.type,
                status: group.status,
                created_at: group.createdAt
            };
            return res.json({ success: true, data });
        } catch (error) {
            return res.status(400).json({ success: false, error: error.message });
        }
    }
}

module.exports = GroupController;
