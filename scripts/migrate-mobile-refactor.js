const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

const run = async () => {
    console.log('🚀 Starting Mobile Refactor Migration...');
    const client = await pool.connect();
    try {
        // Enums cannot be updated in a transaction in some PG versions in strict mode, 
        // but let's try safely adjusting types first.

        console.log('📝 Updating Transaction Types...');
        // We need to add 'PURCHASE' and 'PAYMENT' to transaction_type enum
        // Postgres method: ALTER TYPE name ADD VALUE 'new_value'

        try {
            await client.query("ALTER TYPE transaction_type ADD VALUE IF NOT EXISTS 'PURCHASE'");
            console.log('✅ Added PURCHASE type');
        } catch (e) {
            console.log('ℹ️ PURCHASE type check/add skipped or failed (might exist):', e.message);
        }

        try {
            await client.query("ALTER TYPE transaction_type ADD VALUE IF NOT EXISTS 'PAYMENT'");
            console.log('✅ Added PAYMENT type');
        } catch (e) {
            console.log('ℹ️ PAYMENT type check/add skipped or failed:', e.message);
        }

        await client.query('BEGIN');

        console.log('📝 Migrating Currencies...');

        // 1. Rename 'PTS' to 'CREDITS' in transactions
        await client.query("UPDATE transactions SET currency = 'CREDITS' WHERE currency = 'PTS'");

        // 2. Rename 'EPIC' (if any old ones) to 'CREDITS' for users? Or leave EPIC? 
        // Plan says Student = CREDITS. Let's assume old default EPIC maps to CREDITS for students.
        // And Group admins are EUR.

        // Let's standardise:
        // Update all wallets that are NOT linked to a group (users) to 'CREDITS' if they assume 'PTS' legacy
        // Actually, schema default was 'EPIC'.

        // Update wallets: if group_id is NULL (personal), currency = 'CREDITS'
        await client.query("UPDATE wallets SET currency = 'CREDITS' WHERE group_id IS NULL AND currency IN ('PTS', 'EPIC')");

        // Update wallets: if group_id is NOT NULL (group/bde), ensure currency = 'EUR'
        // CAREFUL: Some group wallets might be intended for credits? 
        // Plan says: BDE Wallet = EUR.
        // Let's force update existing BDE wallets to EUR for consistency with new plan
        await client.query("UPDATE wallets SET currency = 'EUR' WHERE group_id IS NOT NULL");

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
