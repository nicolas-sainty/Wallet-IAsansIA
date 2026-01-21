const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const dbPath = path.join(__dirname, '../database/epicoin.sqlite');
const db = new sqlite3.Database(dbPath);

const runQuery = (query, params = []) => {
    return new Promise((resolve, reject) => {
        db.run(query, params, function (err) {
            if (err) reject(err);
            else resolve(this);
        });
    });
};

const getQuery = (query, params = []) => {
    return new Promise((resolve, reject) => {
        db.get(query, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
};

const seed = async () => {
    console.log('🌱 Seeding BDE Data...');

    try {
        // 1. Create Groups (Assos)
        const groups = [
            { name: 'BDE Alpha 2026', id: uuidv4() },
            { name: 'Club Sport', id: uuidv4() },
            { name: 'Tech Club', id: uuidv4() }
        ];

        for (const group of groups) {
            await runQuery(
                `INSERT INTO groups (group_id, group_name, admin_user_id, status) VALUES (?, ?, ?, 'active')`,
                [group.id, group.name, uuidv4()]
            );
            console.log(`✅ Group created: ${group.name}`);
        }

        // 2. Create Events
        const events = [
            { title: "Soirée d'Intégration", points: 100, group: groups[0] },
            { title: "Tournoi FIFA", points: 50, group: groups[1] },
            { title: "Hackathon IA", points: 200, group: groups[2] }
        ];

        const createdEvents = [];
        for (const evt of events) {
            const evtId = uuidv4();
            await runQuery(
                `INSERT INTO events (event_id, group_id, title, description, event_date, reward_points) 
                 VALUES (?, ?, ?, 'Description event cool', ?, ?)`,
                [evtId, evt.group.id, evt.title, new Date().toISOString(), evt.points]
            ); // Removed extra comma and argument
            createdEvents.push({ ...evt, id: evtId });
            console.log(`✅ Event created: ${evt.title}`);
        }

        // 3. Create Student Wallets
        const students = ['Alice', 'Bob', 'Charlie', 'David'];
        const studentWallets = [];

        for (const name of students) {
            const walletId = uuidv4();
            // Assign to random group mainly for 'origin' but wallets are universal in this system
            const randomGroup = groups[Math.floor(Math.random() * groups.length)];

            await runQuery(
                `INSERT INTO wallets (wallet_id, user_id, group_id, balance, currency, status) 
                 VALUES (?, ?, ?, 0, 'PTS', 'active')`,
                [walletId, uuidv4(), randomGroup.id]
            );
            studentWallets.push({ name, id: walletId });
            console.log(`✅ Wallet created for: ${name}`);
        }

        // 4. Simulate Participation
        for (const student of studentWallets) {
            // Each student participates in 1 or 2 events
            const numEvents = Math.floor(Math.random() * 2) + 1;

            for (let i = 0; i < numEvents; i++) {
                const event = createdEvents[Math.floor(Math.random() * createdEvents.length)];

                // Check if already participated
                const existing = await getQuery(
                    'SELECT 1 FROM event_participants WHERE event_id = ? AND wallet_id = ?',
                    [event.id, student.id]
                );

                if (!existing) {
                    await runQuery(
                        `INSERT INTO event_participants (participant_id, event_id, wallet_id, points_earned)
                         VALUES (?, ?, ?, ?)`,
                        [uuidv4(), event.id, student.id, event.points]
                    );

                    await runQuery(
                        `UPDATE wallets SET balance = balance + ? WHERE wallet_id = ?`,
                        [event.points, student.id]
                    );
                    console.log(`🚀 ${student.name} participated in ${event.title} (+${event.points} pts)`);
                }
            }
        }

        console.log('\n✨ Seeding Complete! Enjoy your BDE app.');

    } catch (error) {
        console.error('❌ Seeding failed:', error);
    } finally {
        db.close();
    }
};

seed();
