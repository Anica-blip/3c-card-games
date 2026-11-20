// admin/auth.js — 3C Card Games sign-in and page guard
// ─────────────────────────────────────────────────────────────────────────────
// Used by admin/login.html, admin/index.html and admin/landing-upload.html.
//
// A visitor gets into an admin page only if they are signed in with GitHub
// (through Supabase, project "Aurion 3C Mascot") AND Supabase's is_owner()
// function says they are the owner. Signing in alone is not enough. The Worker
// and the database repeat the same check, so this file only decides what the
// page shows.
//
// This app keeps its own session name (storageKey): all of Chef's GitHub Pages
// apps share one address (anica-blip.github.io), so each app has its own.
// admin/supabaseAPI.js reuses the client created here (window.sb).
//
// Load order on every admin page (inside <head>, before any other script):
//   <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
//   <script src="./config.js"></script>
//   <script src="./auth.js"></script>
//
// Designed and Built with ❤️ by Claude (Anthropic) × Chef Anica
// 3C Thread To Success™ Cooking Lab 🧪👨‍🍳
// ─────────────────────────────────────────────────────────────────────────────
(() => {
  if (window.__AUTH_LOADED__) return;
  window.__AUTH_LOADED__ = true;

  const STORAGE_KEY = "sb-3c-card-games-login";
  const REDIRECT_TO = "https://anica-blip.github.io/3c-card-games/admin/";
  const NOT_AUTHORISED = "That GitHub account is not authorised for this app.";

  const path = location.pathname.toLowerCase();
  const isLoginPage = path.endsWith("/admin/login.html");

  // Hide protected pages straight away so nothing flashes before the check.
  if (!isLoginPage) document.documentElement.style.visibility = "hidden";

  // Looked up when needed: on admin pages this file loads in <head>, before
  // the page's own elements exist.
  function showError(message) {
    const errorEl = document.getElementById("error-message");
    const successEl = document.getElementById("success-message");
    if (successEl) successEl.classList.remove("show");
    if (errorEl) {
      errorEl.textContent = message;
      errorEl.classList.add("show");
    } else {
      alert(message);
    }
  }

  function showSuccess(message) {
    const errorEl = document.getElementById("error-message");
    const successEl = document.getElementById("success-message");
    if (errorEl) errorEl.classList.remove("show");
    if (successEl) {
      successEl.textContent = message;
      successEl.classList.add("show");
    }
  }

  function toLogin(reason) {
    location.replace("./login.html" + (reason ? "?reason=" + reason : ""));
  }

  function reveal() {
    document.documentElement.style.visibility = "visible";
  }

  if (!window.supabase?.createClient || !window.APP_CONFIG?.SUPABASE_URL || !window.APP_CONFIG?.SUPABASE_ANON_KEY) {
    if (isLoginPage) {
      showError("Sign-in could not load. Please refresh the page.");
    } else {
      toLogin();
    }
    return;
  }

  const sb =
    window.sb ||
    window.supabase.createClient(
      window.APP_CONFIG.SUPABASE_URL,
      window.APP_CONFIG.SUPABASE_ANON_KEY,
      {
        auth: {
          flowType: "pkce",
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          storageKey: STORAGE_KEY,
        },
      }
    );
  window.sb = sb;

  async function signInWithGitHub() {
    showSuccess("Redirecting to GitHub...");
    const { error } = await sb.auth.signInWithOAuth({
      provider: "github",
      options: { redirectTo: REDIRECT_TO },
    });
    if (error) showError("GitHub login failed. Please try again.");
  }

  async function signOut() {
    const { error } = await sb.auth.signOut();
    if (error) {
      showError("Logout failed. Please try again.");
      return;
    }
    location.href = "./login.html";
  }

  async function guardRoutes() {
    try {
      // On the page GitHub sends the visitor back to, getSession() first
      // finishes the sign-in that is in the address, then answers.
      const { data, error } = await sb.auth.getSession();
      const session = data && data.session;

      if (!session) {
        if (isLoginPage) {
          if (error) showError("Session check failed. Please try again.");
          else if (new URLSearchParams(location.search).get("reason") === "notowner") showError(NOT_AUTHORISED);
        } else {
          toLogin();
        }
        return;
      }

      // Signed in — but only the owner gets in. If the owner check cannot be
      // made (for example no network) nobody is signed out; the Worker and the
      // database rules are the real gate.
      const { data: isOwner, error: ownerError } = await sb.rpc("is_owner");
      if (!ownerError && isOwner !== true) {
        await sb.auth.signOut();
        if (isLoginPage) showError(NOT_AUTHORISED);
        else toLogin("notowner");
        return;
      }

      if (isLoginPage) {
        location.replace("./index.html");
        return;
      }

      reveal();
    } catch (err) {
      console.error("[auth] guard error:", err);
      if (!isLoginPage) toLogin();
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
    document.addEventListener("DOMContentLoaded", () => {
      wireButtons();
      guardRoutes();
    });
  } else {
    wireButtons();
    guardRoutes();
  }
})();
