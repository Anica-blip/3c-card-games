// admin/auth.js
(() => {
  if (window.__AUTH_LOADED__) return;
  window.__AUTH_LOADED__ = true;

  const errorEl = document.getElementById("error-message");
  const successEl = document.getElementById("success-message");

  function showError(message) {
    if (successEl) successEl.classList.remove("show");
    if (errorEl) {
      errorEl.textContent = message;
      errorEl.classList.add("show");
    } else {
      alert(message);
    }
  }

  function showSuccess(message) {
    if (errorEl) errorEl.classList.remove("show");
    if (successEl) {
      successEl.textContent = message;
      successEl.classList.add("show");
    }
  }

  if (!window.supabase?.createClient) {
    showError("Supabase library failed to load.");
    return;
  }

  if (!window.APP_CONFIG?.SUPABASE_URL || !window.APP_CONFIG?.SUPABASE_ANON_KEY) {
    showError("Missing Supabase config.");
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
  const isAdminHome = path.endsWith("/admin/") || path.endsWith("/admin/index.html");

  async function signInWithGitHub() {
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
    const { error } = await sb.auth.signOut();
    if (error) {
      showError(`Logout failed: ${error.message}`);
      return;
    }
    location.href = "./login.html";
  }

  async function guardRoutes() {
    const { data, error } = await sb.auth.getSession();
    if (error) {
      showError(`Session check failed: ${error.message}`);
      return;
    }

    const hasSession = !!data?.session;

    if (isLoginPage && hasSession) {
      location.href = "./index.html";
      return;
    }

    if (isAdminHome && !hasSession) {
      location.href = "./login.html";
      return;
    }
  }

  function wireButtons() {
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
      await guardRoutes();
      wireButtons();
    });
  } else {
    guardRoutes().then(wireButtons);
  }
})();
