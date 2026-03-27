/**
 * 3C Card Games - Auth Check for Protected Pages
 * ────────────────────────────────────────────────
 * Include this script at the top of admin pages (index.html, landing-upload.html)
 * to protect them from unauthorized access
 */

// Initialize Supabase client
const supabase = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

// Check authentication on page load
(async function() {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();

    if (error) {
      console.error('Auth check error:', error);
      window.location.href = 'login.html';
      return;
    }

    if (!session) {
      // Not logged in - redirect to login
      window.location.href = 'login.html';
      return;
    }

    // User is authenticated - allow access
    console.log('✅ Authenticated as:', session.user.email || session.user.user_metadata.user_name);

  } catch (error) {
    console.error('Auth check failed:', error);
    window.location.href = 'login.html';
  }
})();

// Add logout button functionality
function addLogoutButton() {
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      try {
        await supabase.auth.signOut();
        window.location.href = 'login.html';
      } catch (error) {
        console.error('Logout error:', error);
        alert('Logout failed: ' + error.message);
      }
    });
  }
}

// Run after DOM loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', addLogoutButton);
} else {
  addLogoutButton();
}
