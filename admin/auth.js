/**
 * 3C Card Games - Authentication Handler
 * GitHub OAuth login via Supabase
 */

// Initialize Supabase client
const supabase = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  }
);

// DOM elements
const githubLoginBtn = document.getElementById('github-login-btn');
const errorMessage = document.getElementById('error-message');
const successMessage = document.getElementById('success-message');

// Show error message
function showError(message) {
  if (!errorMessage) return;
  errorMessage.textContent = message;
  errorMessage.classList.add('show');
  setTimeout(() => errorMessage.classList.remove('show'), 5000);
}

// Show success message
function showSuccess(message) {
  if (!successMessage) return;
  successMessage.textContent = message;
  successMessage.classList.add('show');
  setTimeout(() => successMessage.classList.remove('show'), 3000);
}

// GitHub OAuth login
async function loginWithGitHub() {
  try {
    if (githubLoginBtn) {
      githubLoginBtn.disabled = true;
      githubLoginBtn.textContent = 'Connecting...';
    }

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: REDIRECT_CONFIG.loginRedirect
      }
    });

    if (error) throw error;

    // OAuth redirects automatically
    showSuccess('Redirecting to GitHub...');
  } catch (error) {
    console.error('Login error:', error);
    showError('Login failed: ' + error.message);

    if (githubLoginBtn) {
      githubLoginBtn.disabled = false;
      githubLoginBtn.textContent = 'GitHub Access Connection';
    }
  }
}

// Check if user is logged in (for protected/admin pages)
async function checkAuth() {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) throw error;

    if (!session) {
      window.location.href = REDIRECT_CONFIG.logoutRedirect;
      return false;
    }

    return true;
  } catch (error) {
    console.error('Auth check error:', error);
    window.location.href = REDIRECT_CONFIG.logoutRedirect;
    return false;
  }
}

// Logout
async function logout() {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;

    window.location.href = REDIRECT_CONFIG.logoutRedirect;
  } catch (error) {
    console.error('Logout error:', error);
    showError('Logout failed: ' + error.message);
  }
}

// Login button listener
if (githubLoginBtn) {
  githubLoginBtn.addEventListener('click', loginWithGitHub);
}

// Handle page load/session state
window.addEventListener('load', async () => {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) {
      console.error('Session load error:', error.message);
      return;
    }

    const isLoginPage = window.location.pathname.endsWith('/login.html');

    // Already logged in? Leave login page
    if (session && isLoginPage) {
      showSuccess('Already logged in. Redirecting...');
      setTimeout(() => {
        window.location.href = REDIRECT_CONFIG.loginRedirect;
      }, 500);
    }
  } catch (error) {
    console.error('Load auth check error:', error);
  }
});

// Export helpers
window.authHelpers = {
  checkAuth,
  logout
};
