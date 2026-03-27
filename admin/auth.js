// admin/auth.js
(() => {
  if (window.__AUTH_LOADED__) return;
  window.__AUTH_LOADED__ = true;

  if (!window.supabase?.createClient) {
    console.error("Supabase JS not loaded.");
    return;
  }

  if (!window.APP_CONFIG?.SUPABASE_URL || !window.APP_CONFIG?.SUPABASE_ANON_KEY) {
    console.error("APP_CONFIG missing.");
    return;
  }

  if (!window.sb) {
    window.sb = window.supabase.createClient(
      window.APP_CONFIG.SUPABASE_URL,
      window.APP_CONFIG.SUPABASE_ANON_KEY
    );
  }

  async function handleLogin(email, password) {
    const { error } = await window.sb.auth.signInWithPassword({ email, password });
    if (error) {
      alert(error.message);
      return;
    }
    window.location.href = "./index.html"; // change if your admin landing page differs
  }

  function wireLoginUI() {
    const form = document.getElementById("login-form");
    const emailEl = document.getElementById("email");
    const passEl = document.getElementById("password");
    const btn = document.getElementById("login-button");

    if (form) {
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        await handleLogin(emailEl?.value?.trim() || "", passEl?.value || "");
      });
    }

    if (btn && !form) {
      btn.addEventListener("click", async (e) => {
        e.preventDefault();
        await handleLogin(emailEl?.value?.trim() || "", passEl?.value || "");
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", wireLoginUI);
  } else {
    wireLoginUI();
  }
})();
