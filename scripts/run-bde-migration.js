/**
 * Run Migration Script
 * Applies BDE features migration to PostgreSQL database
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

async function runMigration() {
    console.log('🚀 Running BDE Features Migration...\n');

    const client = await pool.connect();

    try {
        // Read migration file
        const migrationPath = path.join(__dirname, '../database/migrations/add-bde-features.sql');
        const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

        // Execute migration
        await client.query('BEGIN');
        await client.query(migrationSQL);
        await client.query('COMMIT');

        console.log('✅ Migration completed successfully!\n');
        console.log('📝 Changes applied:');
        console.log('   - Added bde_id to users table');
        console.log('   - Created event_status ENUM');
        console.log('   - Added max_participants and current_participants to events');
        console.log('   - Added created_by_user_id to track event creators');
        console.log('   - Created triggers for automatic participant count updates\n');

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Migration failed:', error.message);
        console.error('\nFull error:', error);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

runMigration();
