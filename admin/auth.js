/**
 * 3C Card Games - Authentication Handler
 * ───────────────────────────────────────
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
  if (errorMessage) {
    errorMessage.textContent = message;
    errorMessage.classList.add('show');
    setTimeout(() => {
      errorMessage.classList.remove('show');
    }, 5000);
  }
}

// Show success message
function showSuccess(message) {
  if (successMessage) {
    successMessage.textContent = message;
    successMessage.classList.add('show');
    setTimeout(() => {
      successMessage.classList.remove('show');
    }, 3000);
  }
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
      githubLoginBtn.innerHTML = `
        <svg style="width: 20px; height: 20px; margin-right: 10px; vertical-align: middle;" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
        </svg>
        GitHub Access Connection
      `;
    }
  }
}

// Check if user is already logged in (for admin pages)
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

// Logout function
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

// Event listeners
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

    // If already logged in and currently on login page, send to admin index
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

// Export functions for use in admin pages
window.authHelpers = {
  checkAuth,
  logout
};
