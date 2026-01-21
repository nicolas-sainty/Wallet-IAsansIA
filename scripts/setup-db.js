const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const run = async () => {
    console.log('🚀 Starting Database Setup (Supabase Mode)...');

    if (!process.env.DATABASE_URL) {
        console.error('❌ Error: DATABASE_URL is missing in .env');
        process.exit(1);
    }

    // Postgres connection config
    const config = {
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
    };

    const client = new Client(config);

    try {
        await client.connect();
        console.log('✓ Connected to Supabase');

        // Apply schema directly
        console.log('Applying schema...');

        const schemaPath = path.join(__dirname, '../database/schema.sql');
        const schemaSql = fs.readFileSync(schemaPath, 'utf8');

        // Execute schema
        await client.query(schemaSql);
        console.log('✓ Schema applied successfully');

        await client.end();
        console.log('\n✅ Setup complete! You can now run "npm run dev"');

    } catch (err) {
        console.error('\n❌ Setup failed:', err.message);
        console.error('Hint: Verify your Supabase connection string in DATABASE_URL');
        if (client) await client.end();
        process.exit(1);
    }
};

run();
