const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing env vars');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkTransactions() {
    console.log('Checking recent transactions...');

    // Get latest 5 transactions
    const { data: txs, error } = await supabase
        .from('transactions')
        .select(`
            *,
            source_wallet:source_wallet_id(user_id, group_id),
            dest_wallet:destination_wallet_id(user_id, group_id)
        `)
        .order('created_at', { ascending: false })
        .limit(5);

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log('Latest 5 Transactions:');
    txs.forEach(tx => {
        console.log(`- [${tx.created_at}] ID: ${tx.transaction_id.substring(0, 8)}... Type: ${tx.transaction_type} Amount: ${tx.amount} ${tx.currency}`);
        console.log(`  Source: ${tx.source_wallet_id} | Dest: ${tx.destination_wallet_id}`);
        console.log(`  Desc: ${tx.description}`);
    });
}

checkTransactions();
