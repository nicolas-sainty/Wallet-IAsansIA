const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkToday() {
    const today = new Date().toISOString().split('T')[0]; // 2026-01-28
    console.log(`Checking transactions for ${today}...`);

    const { data: txs, error } = await supabase
        .from('transactions')
        .select('*')
        .gte('created_at', `${today}T00:00:00`)
        .order('created_at', { ascending: false });

    if (error) {
        console.error(error);
        return;
    }

    if (txs.length === 0) {
        console.log("No transactions found for today.");
    } else {
        txs.forEach(tx => {
            console.log(`[${tx.created_at}] Amount: ${tx.amount} ${tx.currency} | Type: ${tx.transaction_type} | Status: ${tx.status}`);
            console.log(`Desc: ${tx.description}`);
            console.log(`Source: ${tx.source_wallet_id} -> Dest: ${tx.destination_wallet_id}`);
            console.log('---');
        });
    }

    // Also check wallets to see user balance
    // We don't know the exact user ID easily without querying users, but let's list modified wallets today
    const { data: wallets } = await supabase
        .from('wallets')
        .select('*, users(email)')
        .gte('updated_at', `${today}T00:00:00`);

    console.log("\nWallets updated today:");
    wallets.forEach(w => {
        console.log(`Wallet ${w.wallet_id} (${w.currency}): ${w.balance} | User: ${w.users?.email}`);
    });
}

checkToday();
