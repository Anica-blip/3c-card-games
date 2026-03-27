// admin/auth.js
(() => {
  if (window.__AUTH_LOADED__) return;
  window.__AUTH_LOADED__ = true;

  if (!window.supabase?.createClient) {
    console.error("Supabase JS not loaded");
    return;
  }

  if (!window.APP_CONFIG?.SUPABASE_URL || !window.APP_CONFIG?.SUPABASE_ANON_KEY) {
    console.error("APP_CONFIG missing");
    return;
  }

  if (!window.sb) {
    window.sb = window.supabase.createClient(
      window.APP_CONFIG.SUPABASE_URL,
      window.APP_CONFIG.SUPABASE_ANON_KEY
    );
  }

  async function signInWithGitHub() {
    const { error } = await window.sb.auth.signInWithOAuth({
      provider: "github",
      options: {
        redirectTo: "https://anica-blip.github.io/3c-card-games/admin/"
      }
    });

    if (error) {
      console.error("GitHub OAuth error:", error.message);
      alert(error.message);
    }
  }

  function wireButton() {
    const btn =
      document.getElementById("github-login-btn") ||
      document.getElementById("login-button") ||
      document.querySelector("[data-github-login]");

    if (!btn) {
      console.warn("GitHub login button not found");
      return;
    }

    btn.addEventListener("click", async (e) => {
      e.preventDefault();
      await signInWithGitHub();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", wireButton);
  } else {
    wireButton();
  }
})();
