const request = require('supertest');
const app = require('../../src/api/server'); // App express

async function run() {
    try {
        console.log('--- Starting E2E Flow ---');
        let studentEmail = `student_${Date.now()}@test.com`;
        let studentPassword = 'StudentPassword123!';
        let bdeEmail = `bde_${Date.now()}@test.com`;
        let bdeId;
        let bdeToken;

        console.log('1. Registering BDE...');
        const res1 = await request(app)
            .post('/api/v2/auth/bde/register')
            .send({
                bdeName: `BDE_E2E_${Date.now()}`,
                email: bdeEmail,
                password: 'StrongPassword123!',
                fullName: 'Admin BDE E2E'
            });
        console.log('Result 1:', res1.status, res1.body);
        if (res1.status !== 201) throw new Error('Failed Register BDE');
        bdeId = res1.body.bdeId;

        console.log('2. Login BDE...');
        const res2 = await request(app)
            .post('/api/v2/auth/login')
            .send({
                email: bdeEmail,
                password: 'StrongPassword123!'
            });
        console.log('Result 2:', res2.status, res2.body.success, res2.body.user);
        if (res2.status !== 200) throw new Error('Failed Login BDE');
        bdeToken = res2.body.token;

        console.log('3. Registering Member...');
        const res3 = await request(app)
            .post('/api/v2/auth/bde/members')
            .set('Authorization', `Bearer ${bdeToken}`)
            .send({
                email: studentEmail,
                fullName: 'Test Student',
                password: studentPassword
            });
        console.log('Result 3:', res3.status, res3.body);
        if (res3.status !== 201) throw new Error('Failed Register Member');

        console.log('4. Login Member...');
        const res4 = await request(app)
            .post('/api/v2/auth/login')
            .send({
                email: studentEmail,
                password: studentPassword
            });
        console.log('Result 4:', res4.status, res4.body.success, res4.body.user);
        if (res4.status !== 200) throw new Error('Failed Login Member');

        console.log('All PASSED! Exiting...');
        process.exit(0);

    } catch (e) {
        console.error('ERROR =>', e);
        process.exit(1);
    }
}

run();
