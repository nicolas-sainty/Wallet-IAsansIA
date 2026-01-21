const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const run = async () => {
    console.log('🚀 Starting BDE Migration Setup...');

    const dbPath = path.join(__dirname, '../database/epicoin.sqlite');
    console.log(`Database path: ${dbPath}`);

    const db = new sqlite3.Database(dbPath);

    const schema = `
    -- Enable foreign keys
    PRAGMA foreign_keys = ON;

    -- Events Table
    CREATE TABLE IF NOT EXISTS events (
        event_id TEXT PRIMARY KEY,
        group_id TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        event_date DATETIME NOT NULL,
        reward_points REAL DEFAULT 0,
        status TEXT DEFAULT 'upcoming', -- upcoming, active, completed, cancelled
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(group_id) REFERENCES groups(group_id) ON DELETE CASCADE
    );

    -- Event Participants Table
    CREATE TABLE IF NOT EXISTS event_participants (
        participant_id TEXT PRIMARY KEY,
        event_id TEXT NOT NULL,
        wallet_id TEXT NOT NULL,
        points_earned REAL DEFAULT 0,
        participated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(event_id, wallet_id),
        FOREIGN KEY(event_id) REFERENCES events(event_id) ON DELETE CASCADE,
        FOREIGN KEY(wallet_id) REFERENCES wallets(wallet_id)
    );
  `;

    db.serialize(() => {
        db.exec(schema, (err) => {
            if (err) {
                console.error('❌ Migration failed:', err.message);
                process.exit(1);
            }
            console.log('✓ BDE Tables created successfully');
        });
    });

    db.close(() => {
        console.log('\n✅ Migration complete!');
    });
};

run();
