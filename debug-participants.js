const { supabase } = require('./src/config/database');

async function testParticipantsQuery() {
    console.log('Testing getEventParticipants query...');

    // Grab any event ID to test with, or just list participants
    const eventId = 'dd073a01-84af-483b-9240-c17df73d4136'; // From user logs

    try {
        const { data, error } = await supabase
            .from('event_participants')
            .select(`
                *,
                wallets (
                    user_id,
                    users (full_name, email)
                )
            `)
            .eq('event_id', eventId)
        //.limit(1);

        if (error) {
            console.error('❌ Supabase Error:', JSON.stringify(error, null, 2));
        } else {
            console.log('✅ Success! Data:', JSON.stringify(data, null, 2));
        }
    } catch (e) {
        console.error('❌ Exception:', e);
    }
}

testParticipantsQuery();
