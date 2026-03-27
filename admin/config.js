/**
 * 3C Card Games - Admin Configuration
 * ────────────────────────────────────
 * Supabase configuration for authentication
 */

const config = {
  supabase: {
    url: typeof process !== 'undefined' && process.env?.SUPABASE_URL 
      ? process.env.SUPABASE_URL 
      : 'https://cgxjqsbrditbteqhdyus.supabase.co',
    anonKey: typeof process !== 'undefined' && process.env?.SUPABASE_ANON_KEY 
      ? process.env.SUPABASE_ANON_KEY 
      : 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNneGpxc2JyZGl0YnRlcWhkeXVzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTExMTY1ODEsImV4cCI6MjA2NjY5MjU4MX0.xUDy5ic-r52kmRtocdcW8Np9-lczjMZ6YKPXc03rIG4',
    serviceKey: typeof process !== 'undefined' && process.env?.SUPABASE_SERVICE_ROLE_KEY 
      ? process.env.SUPABASE_SERVICE_ROLE_KEY 
      : ''
  }
};

// Export for use in other files
const SUPABASE_URL = config.supabase.url;
const SUPABASE_ANON_KEY = config.supabase.anonKey;
const SUPABASE_SERVICE_KEY = config.supabase.serviceKey;

// Redirect URLs for GitHub OAuth
const REDIRECT_CONFIG = {
  loginRedirect: 'https://anica-blip.github.io/3c-card-games/admin/index.html',
  logoutRedirect: 'https://anica-blip.github.io/3c-card-games/admin/login.html'
};
