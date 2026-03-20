const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function debugRpc() {
    const sessionId = 'debug_session_' + Date.now();
    // Use a real user ID from the database if possible
    const { data: users } = await supabase.from('users').select('user_id').limit(1);
    if (!users || users.length === 0) {
        console.error('No users found in DB');
        return;
    }
    const userId = users[0].user_id;

    const { data: groups } = await supabase.from('groups').select('group_id').limit(1);
    const groupId = groups && groups.length > 0 ? groups[0].group_id : null;

    console.log(`Testing RPC with userId: ${userId}, groupId: ${groupId}, session: ${sessionId}`);

    const { data, error } = await supabase.rpc('rpc_fulfill_stripe_checkout_atomic', {
        p_stripe_session_id: sessionId,
        p_user_id: userId,
        p_bde_group_id: groupId,
        p_credits_amount: 10.5,
        p_amount_eur: 1.05
    });

    if (error) {
        console.error('RPC Error:', error);
    } else {
        console.log('RPC Result:', data);
        
        // Check wallet
        const { data: wallet } = await supabase
            .from('wallets')
            .select('*')
            .eq('user_id', userId)
            .eq('currency', 'CREDITS')
            .single();
        
        console.log('User Wallet after RPC:', wallet);
    }
}

debugRpc();
