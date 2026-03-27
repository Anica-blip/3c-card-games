/**
 * 3C Card Games - Sign out functionality
 */

async function signOut() {
  try {
    // Prefer shared logout helper from auth.js
    if (window.authHelpers?.logout) {
      await window.authHelpers.logout();
      return;
    }

    // Fallback: direct sign-out if helper is unavailable
    const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { error } = await client.auth.signOut();
    if (error) throw error;

    window.location.href = REDIRECT_CONFIG?.logoutRedirect || 'login.html';
  } catch (error) {
    console.error('Sign out failed:', error);
    // Always send user back to login page
    window.location.href = REDIRECT_CONFIG?.logoutRedirect || 'login.html';
  }
}
