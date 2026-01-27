const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

const run = async () => {
    console.log('🚀 Starting Logic Rework Migration...');
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Add status column to event_participants if not exists
        console.log('📝 Altering event_participants table...');

        // Check if column exists first to be safe (idempotent)
        const checkCol = await client.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name='event_participants' AND column_name='status'
        `);

        if (checkCol.rows.length === 0) {
            await client.query(`
                ALTER TABLE event_participants 
                ADD COLUMN status VARCHAR(50) DEFAULT 'pending';
            `);
            console.log('✅ Added "status" column.');
        } else {
            console.log('ℹ️ "status" column already exists.');
        }

        await client.query('COMMIT');
        console.log('✅ Migration successful!');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('❌ Migration failed:', err);
        process.exit(1);
    } finally {
        client.release();
        pool.end();
    }
};

run();
