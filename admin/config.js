/**
 * 3C Card Games - Admin Configuration
 * Supabase browser-safe config (GitHub Pages)
 */

// Public values only (safe for frontend)
const SUPABASE_URL = 'https://cgxjqsbrditbteqhdyus.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNneGpxc2JyZGl0YnRlcWhkeXVzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTExMTY1ODEsImV4cCI6MjA2NjY5MjU4MX0.xUDy5ic-r52kmRtocdcW8Np9-lczjMZ6YKPXc03rIG4';

// OAuth redirect config
const REDIRECT_CONFIG = {
  loginRedirect: 'https://anica-blip.github.io/3c-card-games/admin/index.html',
  logoutRedirect: 'https://anica-blip.github.io/3c-card-games/admin/login.html'
};
