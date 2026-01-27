const http = require('http');

const API_PORT = 3000;
const BASE_URL = `http://localhost:${API_PORT}/api`;

const request = (method, path, data = null, token = null) => {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: API_PORT,
            path: `/api${path}`,
            method: method,
            headers: {
                'Content-Type': 'application/json',
            }
        };

        if (token) {
            options.headers['Authorization'] = `Bearer ${token}`;
        }

        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(body);
                    resolve({ status: res.statusCode, body: parsed });
                } catch (e) {
                    resolve({ status: res.statusCode, body });
                }
            });
        });

        req.on('error', (e) => reject(e));

        if (data) {
            req.write(JSON.stringify(data));
        }
        req.end();
    });
};

const run = async () => {
    try {
        console.log('🔍 Testing API Health...');
        const health = await request('GET', '/../health'); // ../ to get out of /api/
        console.log('Health:', health.body);

        // 1. Register/Login
        const email = `test.debug.${Date.now()}@example.com`;
        const password = 'password123';
        console.log(`\n👤 Registering user ${email}...`);

        const regRes = await request('POST', '/auth/register', {
            email, password, fullName: 'Debug User'
        });

        if (regRes.status !== 200 && regRes.status !== 201) {
            console.error('❌ Registration Failed:', regRes.body);
            // Try login if already exists (unlikely with timestamp)
        }

        console.log('🔑 Logging in...');
        const loginRes = await request('POST', '/auth/login', { email, password });
        if (!loginRes.body.token) {
            console.error('❌ Login Failed:', loginRes.body);
            return;
        }
        const token = loginRes.body.token;
        console.log('✅ Logged in.');

        // 2. Create Group
        console.log('\n🏢 Creating Group...');
        const groupRes = await request('POST', '/groups', {
            groupName: `Debug Group ${Date.now()}`,
            adminUserId: loginRes.body.user.userId
        }, token);

        if (groupRes.status !== 200 && groupRes.status !== 201) {
            console.error('❌ Group Creation Failed:', groupRes.body);
            return;
        }
        console.log('✅ Group Created Response:', JSON.stringify(groupRes.body, null, 2));
        const groupId = groupRes.body.data.group_id;

        // 3. Create Wallet
        console.log('\n💰 Creating Wallet...');
        const walletRes = await request('POST', '/wallets', {
            groupId: groupId,
            currency: 'EPIC'
        }, token);

        if (walletRes.status !== 200 && walletRes.status !== 201) {
            console.error('❌ Wallet Creation Failed:', walletRes.body);
        } else {
            console.log('✅ Wallet Created Response:', JSON.stringify(walletRes.body, null, 2));
        }

        // 4. Create Event
        console.log('\n🎉 Creating Event...');
        const eventRes = await request('POST', '/events', {
            groupId: groupId,
            title: 'Debug Event',
            description: 'Testing',
            eventDate: new Date().toISOString(),
            rewardPoints: 100
        }, token);

        if (eventRes.status !== 200 && eventRes.status !== 201) {
            console.error('❌ Event Creation Failed:', eventRes.body);
        } else {
            console.log('✅ Event Created:', eventRes.body.event_id);
        }

    } catch (error) {
        console.error('FATAL ERROR:', error.message);
    }
};

run();
