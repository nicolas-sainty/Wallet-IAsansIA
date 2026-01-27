require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function listTransactions() {
    try {
        const { data: txs, error } = await supabase
            .from('transactions')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(5);

        if (error) throw error;

        console.log("Recent Transactions:");
        txs.forEach(tx => {
            console.log(`ID: ${tx.transaction_id}`);
            console.log(`  CreatedAt: ${tx.created_at}`);
            console.log(`  Amount: ${tx.amount}`);
            console.log(`  Source: ${tx.source_wallet_id}`);
            console.log(`  Dest:   ${tx.destination_wallet_id}`);
            console.log(`  Desc:   ${tx.description}`);
            console.log('------------------------------------------------');
        });

    } catch (err) {
        console.error("Error:", err);
    }
}

listTransactions();
