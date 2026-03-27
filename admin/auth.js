// admin/auth.js
(() => {
  // Prevent redeclaration if script is included twice
  if (window.__AUTH_LOADED__) return;
  window.__AUTH_LOADED__ = true;

  // Require Supabase CDN script loaded first
  if (!window.supabase || !window.supabase.createClient) {
    console.error("Supabase JS not loaded. Include CDN before auth.js");
    return;
  }

  if (!window.APP_CONFIG?.SUPABASE_URL || !window.APP_CONFIG?.SUPABASE_ANON_KEY) {
    console.error("APP_CONFIG missing. Ensure config.js is loaded before auth.js");
    return;
  }

  // Reuse existing client if already created
  if (!window.sb) {
    window.sb = window.supabase.createClient(
      window.APP_CONFIG.SUPABASE_URL,
      window.APP_CONFIG.SUPABASE_ANON_KEY
    );
  }

  // Optional helpers
  window.authHelpers = {
    async getSession() {
      return await window.sb.auth.getSession();
    },
    async signOut() {
      return await window.sb.auth.signOut();
    }
  };
})();
