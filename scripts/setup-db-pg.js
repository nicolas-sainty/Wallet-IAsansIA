const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

const run = async () => {
    console.log('🚀 Starting PostgreSQL Setup...');

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Read Core Schema (Groups, Wallets, Transactions)
        console.log('📝 Applying core schema...');
        const schemaPath = path.join(__dirname, '../database/schema.sql');
        const coreSchema = fs.readFileSync(schemaPath, 'utf8');
        await client.query(coreSchema);

        // 2. Add Users Table (From setup-auth-db.js but adapted for Postgres)
        console.log('👤 Creating users table...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                user_id UUID PRIMARY KEY,
                email VARCHAR(255) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                full_name VARCHAR(255),
                role VARCHAR(50) DEFAULT 'student',
                is_verified BOOLEAN DEFAULT false,
                verification_token UUID,
                reset_token UUID,
                reset_expires TIMESTAMP WITH TIME ZONE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );

            CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
        `);

        // 3. Add BDE/Events Tables (From setup-bde-features.js but adapted for Postgres)
        console.log('🎉 Creating events tables...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS events (
                event_id UUID PRIMARY KEY,
                group_id UUID NOT NULL REFERENCES groups(group_id) ON DELETE CASCADE,
                title VARCHAR(255) NOT NULL,
                description TEXT,
                event_date TIMESTAMP WITH TIME ZONE NOT NULL,
                reward_points DECIMAL(20, 8) DEFAULT 0,
                status VARCHAR(50) DEFAULT 'upcoming',
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS event_participants (
                participant_id UUID PRIMARY KEY,
                event_id UUID NOT NULL REFERENCES events(event_id) ON DELETE CASCADE,
                wallet_id UUID NOT NULL REFERENCES wallets(wallet_id),
                points_earned DECIMAL(20, 8) DEFAULT 0,
                participated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                UNIQUE(event_id, wallet_id)
            );

            CREATE INDEX IF NOT EXISTS idx_events_group ON events(group_id);
            CREATE INDEX IF NOT EXISTS idx_participants_event ON event_participants(event_id);
            CREATE INDEX IF NOT EXISTS idx_participants_wallet ON event_participants(wallet_id);
        `);

        await client.query('COMMIT');
        console.log('✅ PostgreSQL Schema applied successfully!');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('❌ Setup failed:', err);
        process.exit(1);
    } finally {
        client.release();
        pool.end();
    }
};

run();
