require('dotenv').config();
const { Client } = require('pg');

const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function createTable() {
    try {
        await client.connect();
        console.log('Connected to Postgres');

        const query = `
            CREATE TABLE IF NOT EXISTS payment_requests (
                request_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                bde_group_id UUID NOT NULL REFERENCES groups(group_id),
                student_user_id UUID NOT NULL REFERENCES users(user_id),
                amount DECIMAL(10, 2) NOT NULL,
                description TEXT,
                status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PAID', 'REJECTED')),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );

            -- Index for performance
            CREATE INDEX IF NOT EXISTS idx_payment_requests_student ON payment_requests(student_user_id);
            CREATE INDEX IF NOT EXISTS idx_payment_requests_bde ON payment_requests(bde_group_id);
        `;

        await client.query(query);
        console.log('✅ Value Table payment_requests created successfully');
    } catch (err) {
        console.error('❌ Error creating table:', err);
    } finally {
        await client.end();
    }
}

createTable();
