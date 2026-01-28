const { supabase } = require('./src/config/database');

async function checkBalances() {
    console.log('🔍 Checking Wallets (Manual Join)...');

    // 1. Get Wallets
    const { data: wallets, error } = await supabase
        .from('wallets')
        .select('*') // Get everything including status
        .order('updated_at', { ascending: false }) // Most recently updated
        .limit(5);

    if (error) {
        console.error('Error fetching wallets:', error);
        return;
    }

    if (wallets.length === 0) {
        console.log("No wallets found.");
        return;
    }

    // 2. Get Users
    const userIds = [...new Set(wallets.map(w => w.user_id))];
    const { data: users } = await supabase
        .from('users')
        .select('user_id, email, full_name')
        .in('user_id', userIds);

    const userMap = users ? users.reduce((acc, u) => ({ ...acc, [u.user_id]: u }), {}) : {};

    // 3. Print
    for (const w of wallets) {
        const u = userMap[w.user_id];
        console.log(`User: ${u?.email || 'Unknown'} (${w.user_id})`);
        console.log(`  Wallet: ${w.wallet_id}`);
        console.log(`  Currency: ${w.currency}`);
        console.log(`  Balance: ${w.balance}`);
        console.log(`  Status: ${w.status}`);
        console.log(`  Last Updated: ${w.updated_at}`);
        console.log('-----------------------------------');
    }

    // 4. Check Transactions for first wallet
    if (wallets.length > 0) {
        console.log("\nRecent Transactions for first wallet:");
        const w = wallets[0];
        const { data: txs } = await supabase
            .from('transactions')
            .select('*')
            .or(`source_wallet_id.eq.${w.wallet_id},destination_wallet_id.eq.${w.wallet_id}`)
            .order('created_at', { ascending: false })
            .limit(5);

        console.log(txs);
    }
}

checkBalances();
