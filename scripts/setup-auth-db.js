const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const run = async () => {
    console.log('🚀 Starting Auth Migration...');

    const dbPath = path.join(__dirname, '../database/epicoin.sqlite');
    console.log(`Database path: ${dbPath}`);

    const db = new sqlite3.Database(dbPath);

    const schema = `
    -- Users Table
    CREATE TABLE IF NOT EXISTS users (
        user_id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        full_name TEXT,
        role TEXT DEFAULT 'student', -- student, bde_admin, admin
        is_verified INTEGER DEFAULT 0,
        verification_token TEXT,
        reset_token TEXT,
        reset_expires DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Add owner_id to wallets if not exist (we will link wallets to real users)
    -- SQLite doesn't support IF NOT EXISTS for columns easily in one line, 
    -- but our previous schema used 'user_id' in wallets as a text field. 
    -- We can reuse 'user_id' column in wallets table as the foreign key to users.user_id.
    
    -- Same for groups.admin_user_id.
  `;

    db.serialize(() => {
        db.exec(schema, (err) => {
            if (err) {
                console.error('❌ Migration failed:', err.message);
                process.exit(1);
            }
            console.log('✓ Users Table created successfully');
        });
    });

    db.close(() => {
        console.log('\n✅ Auth Migration complete!');
    });
};

run();
