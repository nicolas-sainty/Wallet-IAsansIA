const request = require('supertest');
const app = require('../../src/api/server'); // App express
const { supabase } = require('../../src/config/database');

describe('BDE Authentication End-to-End Flow', () => {
    let bdeToken;
    let bdeId;
    let studentEmail = `student_${Date.now()}@test.com`;
    let studentPassword = 'StudentPassword123!';
    let bdeEmail = `bde_${Date.now()}@test.com`;

    // Nettoyage après les tests si on touche à la vraie base Supabase de Test (ou DB Mockée)
    afterAll(async () => {
        // En vrai mode test d'intégration, il faudrait supprimer les comptes créés.
        // Optionnel selon ta conf de db : test
    });

    it('1. Should register a new BDE', async () => {
        const response = await request(app)
            .post('/api/v2/auth/bde/register')
            .send({
                bdeName: `BDE_E2E_${Date.now()}`,
                email: bdeEmail,
                password: 'StrongPassword123!',
                fullName: 'Admin BDE E2E'
            });

        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
        expect(response.body.bdeId).toBeDefined();
        
        bdeId = response.body.bdeId;
    });

    it('2. Should login as BDE and get a token', async () => {
        const response = await request(app)
            .post('/api/v2/auth/login')
            .send({
                email: bdeEmail,
                password: 'StrongPassword123!'
            });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.token).toBeDefined();
        expect(response.body.user.role).toBe('bde_admin');
        
        bdeToken = response.body.token;
    });

    it('3. Should fail to create member without token', async () => {
        const response = await request(app)
            .post('/api/v2/auth/bde/members')
            .send({
                email: studentEmail,
                fullName: 'Test Student',
                password: studentPassword
            });

        expect(response.status).toBe(401);
    });

    it('4. Should create member access using BDE token', async () => {
        const response = await request(app)
            .post('/api/v2/auth/bde/members')
            .set('Authorization', `Bearer ${bdeToken}`)
            .send({
                email: studentEmail,
                fullName: 'Test Student',
                password: studentPassword
            });

        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
        expect(response.body.bdeId).toBe(bdeId);
    });

    it('5. Should login as the newly created student member', async () => {
        const response = await request(app)
            .post('/api/v2/auth/login')
            .send({
                email: studentEmail,
                password: studentPassword
            });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.token).toBeDefined();
        expect(response.body.user.role).toBe('student');
        expect(response.body.user.bde_id).toBe(bdeId);
    });
});
