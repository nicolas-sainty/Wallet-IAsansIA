const { Client } = require('pg');
require('dotenv').config();

const run = async () => {
    console.log('🔍 Diagnostics de connexion...');

    const url = process.env.DATABASE_URL;
    if (!url) {
        console.error('❌ DATABASE_URL manquant');
        return;
    }

    // Mask password for display
    const maskedUrl = url.replace(/:([^:@]+)@/, ':****@');
    console.log(`URL utilisée: ${maskedUrl}`);

    const config = {
        connectionString: url,
        ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
        connectionTimeoutMillis: 5000,
    };

    console.log('SSL activé:', config.ssl ? 'Oui' : 'Non');

    const client = new Client(config);

    try {
        console.log('Tentative de connexion...');
        await client.connect();
        console.log('✅ Connexion RÉUSSIE !');

        const res = await client.query('SELECT NOW()');
        console.log('Heure serveur:', res.rows[0].now);

        await client.end();
    } catch (err) {
        console.error('❌ ÉCHEC de connexion:');
        console.error(`Code: ${err.code}`);
        console.error(`Message: ${err.message}`);
        if (err.message.includes('password')) {
            console.error('⚠️  Problème probable de mot de passe ou de caractères spéciaux.');
        } else if (err.message.includes('Tenant')) {
            console.error('⚠️  Problème de Project ID ou de Région (Hostname).');
        }
    }
};

run();
