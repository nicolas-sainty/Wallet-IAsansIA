const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const run = async () => {
    console.log('🚀 Starting SQLite Setup...');

    const dbPath = path.join(__dirname, '../database/epicoin.sqlite');
    console.log(`Database path: ${dbPath}`);

    const db = new sqlite3.Database(dbPath);

    const schema = `
    -- Enable foreign keys
    PRAGMA foreign_keys = ON;

    -- Groups Table
    CREATE TABLE IF NOT EXISTS groups (
        group_id TEXT PRIMARY KEY,
        group_name TEXT NOT NULL UNIQUE,
        admin_user_id TEXT,
        status TEXT DEFAULT 'active',
        settings TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Wallets Table
    CREATE TABLE IF NOT EXISTS wallets (
        wallet_id TEXT PRIMARY KEY,
        user_id TEXT,
        group_id TEXT,
        balance REAL DEFAULT 0.0 CHECK (balance >= 0),
        currency TEXT DEFAULT 'EPIC',
        status TEXT DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(group_id) REFERENCES groups(group_id) ON DELETE CASCADE
    );

    -- Transactions Table
    CREATE TABLE IF NOT EXISTS transactions (
        transaction_id TEXT PRIMARY KEY,
        provider TEXT,
        provider_tx_id TEXT,
        initiator_user_id TEXT,
        source_wallet_id TEXT,
        destination_wallet_id TEXT,
        amount REAL NOT NULL CHECK (amount > 0),
        currency TEXT DEFAULT 'EPIC',
        transaction_type TEXT NOT NULL,
        direction TEXT NOT NULL,
        status TEXT DEFAULT 'PENDING',
        reason_code TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        provider_created_at DATETIME,
        executed_at DATETIME,
        country TEXT,
        city TEXT,
        description TEXT,
        metadata TEXT,
        FOREIGN KEY(source_wallet_id) REFERENCES wallets(wallet_id),
        FOREIGN KEY(destination_wallet_id) REFERENCES wallets(wallet_id)
    );

    -- Group Trust Scores
    CREATE TABLE IF NOT EXISTS group_trust_scores (
        trust_id TEXT PRIMARY KEY,
        from_group_id TEXT,
        to_group_id TEXT,
        trust_score REAL DEFAULT 50.00,
        total_transactions INTEGER DEFAULT 0,
        total_volume REAL DEFAULT 0.00,
        successful_transactions INTEGER DEFAULT 0,
        failed_transactions INTEGER DEFAULT 0,
        last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(from_group_id, to_group_id),
        FOREIGN KEY(from_group_id) REFERENCES groups(group_id) ON DELETE CASCADE,
        FOREIGN KEY(to_group_id) REFERENCES groups(group_id) ON DELETE CASCADE
    );

    -- Exchange Rules
    CREATE TABLE IF NOT EXISTS exchange_rules (
        rule_id TEXT PRIMARY KEY,
        from_group_id TEXT,
        to_group_id TEXT,
        max_transaction_amount REAL,
        daily_limit REAL,
        requires_approval INTEGER DEFAULT 0,
        commission_rate REAL DEFAULT 0.0,
        active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(from_group_id, to_group_id),
        FOREIGN KEY(from_group_id) REFERENCES groups(group_id) ON DELETE CASCADE,
        FOREIGN KEY(to_group_id) REFERENCES groups(group_id) ON DELETE CASCADE
    );
  `;

    db.serialize(() => {
        db.exec(schema, (err) => {
            if (err) {
                console.error('❌ Schema application failed:', err.message);
                process.exit(1);
            }
            console.log('✓ SQLite schema applied successfully');
        });
    });

    db.close(() => {
        console.log('\n✅ Setup complete! You can now run "npm run dev"');
    });
};

run();
