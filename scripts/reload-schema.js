require('dotenv').config();
const { Client } = require('pg');

const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function reloadSchema() {
    try {
        await client.connect();
        console.log('Connected to Postgres');

        await client.query("NOTIFY pgrst, 'reload schema'");
        console.log('✅ Schema Cache Reload Triggered');
    } catch (err) {
        console.error('❌ Error reloading schema:', err);
    } finally {
        await client.end();
    }
}

reloadSchema();
