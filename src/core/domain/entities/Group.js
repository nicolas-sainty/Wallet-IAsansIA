class Group {
    constructor({ group_id, group_name, admin_user_id, status, settings, created_at }) {
        this.groupId = group_id;
        this.groupName = group_name;
        this.adminUserId = admin_user_id;
        this.status = status || 'active';
        this.settings = settings || {};
        this.createdAt = created_at;
    }

    isActive() {
        return this.status === 'active';
    }
}

module.exports = Group;
