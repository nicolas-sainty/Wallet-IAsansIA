const Group = require('../../../../../src/core/domain/entities/Group');

describe('Group Entity', () => {
    it('should create a Group instance with correct properties', () => {
        const groupData = {
            group_id: 'g1',
            group_name: 'BDE',
            admin_user_id: 'u1',
            status: 'inactive',
            settings: { theme: 'dark' },
            created_at: '2024-01-01'
        };

        const group = new Group(groupData);

        expect(group.groupId).toBe('g1');
        expect(group.groupName).toBe('BDE');
        expect(group.adminUserId).toBe('u1');
        expect(group.status).toBe('inactive');
        expect(group.settings).toEqual({ theme: 'dark' });
        expect(group.createdAt).toBe('2024-01-01');
    });

    it('should set default values when not provided', () => {
        const group = new Group({ group_id: 'g2' });
        expect(group.status).toBe('active');
        expect(group.settings).toEqual({});
    });

    it('isActive() should return true when status is active', () => {
        const group = new Group({ status: 'active' });
        expect(group.isActive()).toBe(true);
    });

    it('isActive() should return false when status is not active', () => {
        const group = new Group({ status: 'inactive' });
        expect(group.isActive()).toBe(false);
    });
});
