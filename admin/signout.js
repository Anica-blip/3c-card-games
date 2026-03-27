/**
 * 3C Card Games - Sign out functionality
 * ───────────────────────────────────────
 */

async function signOut() {
    try {
        // Get Supabase credentials from config.js
        const url = typeof SUPABASE_URL !== 'undefined' ? SUPABASE_URL : '';
        const key = typeof SUPABASE_ANON_KEY !== 'undefined' ? SUPABASE_ANON_KEY : '';
        
        if (url && key && url !== '' && key !== '') {
            const client = supabase.createClient(url, key);
            const { error } = await client.auth.signOut();
            
            if (error) throw error;
        }
        
        console.log('✅ Signed out successfully');
        
        // Redirect to login page
        window.location.href = 'login.html';
        
    } catch (error) {
        console.error('❌ Sign out failed:', error);
        // Still redirect to login even if sign out fails
        window.location.href = 'login.html';
    }
}
