// admin/auth.js
(() => {
  if (window.__AUTH_LOADED__) return;
  window.__AUTH_LOADED__ = true;

  const errorEl = document.getElementById("error-message");
  const successEl = document.getElementById("success-message");

  function showError(msg) {
    if (!errorEl) return alert(msg);
    errorEl.textContent = msg;
    errorEl.classList.add("show");
  }

  function showSuccess(msg) {
    if (!successEl) return;
    successEl.textContent = msg;
    successEl.classList.add("show");
  }

  function clearMessages() {
    errorEl?.classList.remove("show");
    successEl?.classList.remove("show");
  }

  if (!window.supabase?.createClient) {
    showError("Supabase library failed to load.");
    return;
  }

  if (!window.APP_CONFIG?.SUPABASE_URL || !window.APP_CONFIG?.SUPABASE_ANON_KEY) {
    showError("Missing APP_CONFIG in config.js");
    return;
  }

  const sb =
    window.sb ||
    window.supabase.createClient(
      window.APP_CONFIG.SUPABASE_URL,
      window.APP_CONFIG.SUPABASE_ANON_KEY
    );
  window.sb = sb;

  const path = location.pathname.toLowerCase();
  const isLoginPage = path.endsWith("/admin/login.html");
  const isAdminIndex = path.endsWith("/admin/") || path.endsWith("/admin/index.html");

  async function signInWithGitHub() {
    clearMessages();
    showSuccess("Redirecting to GitHub...");
    const { error } = await sb.auth.signInWithOAuth({
      provider: "github",
      options: {
        redirectTo: "https://anica-blip.github.io/3c-card-games/admin/"
      }
    });
    if (error) showError(`GitHub login failed: ${error.message}`);
  }

  async function signOut() {
    clearMessages();
    const { error } = await sb.auth.signOut();
    if (error) return showError(`Logout failed: ${error.message}`);
    location.href = "./login.html";
  }

  async function guard() {
    const { data, error } = await sb.auth.getSession();
    if (error) {
      showError(`Session check failed: ${error.message}`);
      return;
    }

    const hasSession = !!data.session;

    if (isLoginPage && hasSession) location.href = "./index.html";
    if (isAdminIndex && !hasSession) location.href = "./login.html";
  }

  function wire() {
    const loginBtn = document.getElementById("github-login-btn");
    if (loginBtn) {
      loginBtn.addEventListener("click", async (e) => {
        e.preventDefault();
        await signInWithGitHub();
      });
    }

    const logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", async (e) => {
        e.preventDefault();
        await signOut();
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", async () => {
      await guard();
      wire();
    });
  } else {
    guard().then(wire);
  }
})();
