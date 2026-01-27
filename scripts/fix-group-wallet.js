require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const GROUP_ID = 'caf8e480-3eb5-470d-8407-adb8f7fce6fe'; // From the error log

async function createGroupWallet() {
    try {
        console.log(`Checking wallets for Group: ${GROUP_ID}`);

        // Check if one exists
        const { data: existing, error: fetchError } = await supabase
            .from('wallets')
            .select('*')
            .eq('group_id', GROUP_ID)
            .is('user_id', null)
            .eq('currency', 'CREDITS');

        if (existing && existing.length > 0) {
            console.log("✅ Group Wallet already exists:", existing[0]);
            return;
        }

        console.log("⚠️ No Group Wallet found. Creating one...");

        // Create Wallet
        const { data: newWallet, error: createError } = await supabase
            .from('wallets')
            .insert({
                group_id: GROUP_ID,
                user_id: null,
                currency: 'CREDITS',
                balance: 1000.00, // Initial endowment for testing
                status: 'active',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .select()
            .single();

        if (createError) throw createError;

        console.log("✅ Group Wallet created successfully:", newWallet);

    } catch (err) {
        console.error("❌ Error:", err);
    }
}

createGroupWallet();
