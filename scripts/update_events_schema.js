
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const run = async () => {
    console.log('🚀 Updating Events Schema...');

    const dbPath = path.join(__dirname, '../database/epicoin.sqlite');
    const db = new sqlite3.Database(dbPath);

    const schema = `
    -- Events Table (Ensure exists)
    CREATE TABLE IF NOT EXISTS events (
        event_id TEXT PRIMARY KEY,
        group_id TEXT,
        title TEXT NOT NULL,
        description TEXT,
        event_date DATETIME,
        reward_points REAL DEFAULT 0,
        status TEXT DEFAULT 'upcoming',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Participants Table (Re-create or Ensure exists with status)
    -- since SQLite ALTER TABLE is limited, we will just create it if missing, 
    -- and try to add the column if it exists and is missing it.
    CREATE TABLE IF NOT EXISTS event_participants (
        participant_id TEXT PRIMARY KEY,
        event_id TEXT,
        wallet_id TEXT,
        points_earned REAL,
        status TEXT DEFAULT 'PENDING',
        participated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(event_id) REFERENCES events(event_id),
        FOREIGN KEY(wallet_id) REFERENCES wallets(wallet_id)
    );
    `;

    db.serialize(() => {
        db.exec(schema, (err) => {
            if (err) {
                console.error('Schema creation/check failed:', err);
            } else {
                console.log('Tables ensured.');
            }
        });

        // Try to add status column if it doesn't exist (harmless error if it does)
        db.run("ALTER TABLE event_participants ADD COLUMN status TEXT DEFAULT 'PENDING'", (err) => {
            if (err && !err.message.includes('duplicate column')) {
                // If it's not a duplicate column error, log it
                // console.log('Column might already exist or:', err.message);
            } else {
                console.log('Added status column to event_participants');
            }
        });
    });

    // Wait and close
    setTimeout(() => {
        db.close(() => {
            console.log('✅ Schema update complete.');
        });
    }, 1000);
};

run();
