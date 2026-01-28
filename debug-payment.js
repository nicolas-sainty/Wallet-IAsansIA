const { supabase } = require('./src/config/database');

async function testPaymentRequest() {
    console.log('Testing createPaymentRequest...');

    // 1. Get a BDE Group
    const { data: groups } = await supabase.from('groups').select('group_id').limit(1);
    const bdeId = groups[0]?.group_id;

    // 2. Get a User
    const { data: users } = await supabase.from('users').select('user_id').limit(1);
    const userId = users[0]?.user_id;

    console.log(`BDE: ${bdeId}, User: ${userId}`);

    if (!bdeId || !userId) {
        console.error('Missing data to test');
        return;
    }

    // 3. Try Insert
    const { data, error } = await supabase
        .from('payment_requests')
        .insert({
            bde_group_id: bdeId,
            student_user_id: userId,
            amount: 10,
            description: 'Test Debug',
            status: 'PENDING'
        })
        .select()
        .single();

    if (error) {
        console.error('❌ Insert Failed:', error);
    } else {
        console.log('✅ Insert Success:', data);
        // Clean up
        await supabase.from('payment_requests').delete().eq('request_id', data.request_id);
    }
}

testPaymentRequest();
