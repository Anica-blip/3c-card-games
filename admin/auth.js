# GitHub OAuth Setup for 3C Card Games Admin

This guide will help you set up GitHub OAuth authentication to protect your admin panel.

---

## Step 1: Enable GitHub OAuth in Supabase

1. **Go to your Supabase Dashboard**
   - Navigate to: https://supabase.com/dashboard/project/cgxjqsbrditbteqhdyus

2. **Open Authentication Settings**
   - Click on **Authentication** in the left sidebar
   - Click on **Providers**

3. **Enable GitHub Provider**
   - Find **GitHub** in the list of providers
   - Toggle it to **Enabled**

4. **Create a GitHub OAuth App**
   - Go to GitHub: https://github.com/settings/developers
   - Click **New OAuth App**
   - Fill in the details:
     - **Application name**: `3C Card Games Admin`
     - **Homepage URL**: `https://anica-blip.github.io/3c-card-games/`
     - **Authorization callback URL**: `https://cgxjqsbrditbteqhdyus.supabase.co/auth/v1/callback`
   - Click **Register application**

5. **Copy GitHub OAuth Credentials**
   - Copy the **Client ID**
   - Click **Generate a new client secret** and copy it

6. **Add Credentials to Supabase**
   - Go back to Supabase → Authentication → Providers → GitHub
   - Paste the **Client ID** in the GitHub Client ID field
   - Paste the **Client Secret** in the GitHub Client Secret field
   - Click **Save**

---

## Step 2: Add Auth Protection to Admin Pages

You need to add the authentication check script to your admin pages.

### For `admin/index.html`:

Add these lines **after** the existing `<script>` tags but **before** the closing `</head>` tag:

```html
<!-- Auth Protection -->
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="config.js"></script>
<script src="auth-check.js"></script>
```

### For `admin/landing-upload.html`:

Add the same lines in the `<head>` section:

```html
<!-- Auth Protection -->
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="config.js"></script>
<script src="auth-check.js"></script>
```

---

## Step 3: Add Logout Button (Optional)

If you want to add a logout button to your admin pages, add this HTML wherever you want the button to appear:

```html
<button id="logoutBtn" style="background: #e74c3c; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">
  Logout
</button>
```

The `auth-check.js` script will automatically wire up the logout functionality.

---

## Step 4: Test the Login Flow

1. **Push all files to GitHub**:
   - `admin/config.js`
   - `admin/auth.js`
   - `admin/auth-check.js`
   - `admin/login.html` (already updated)
   - `admin/index.html` (after adding auth scripts)
   - `admin/landing-upload.html` (after adding auth scripts)

2. **Wait for GitHub Pages to deploy** (usually 1-2 minutes)

3. **Test the flow**:
   - Visit: `https://anica-blip.github.io/3c-card-games/admin/login.html`
   - Click **GitHub Access Connection**
   - Authorize the app on GitHub
   - You should be redirected to `admin/index.html`

4. **Test protection**:
   - Try visiting `admin/index.html` directly without logging in
   - You should be redirected to the login page

---

## How It Works

1. **Login Page** (`login.html`):
   - User clicks "GitHub Access Connection"
   - Redirects to GitHub for authorization
   - GitHub redirects back to Supabase
   - Supabase creates a session and redirects to `admin/index.html`

2. **Protected Pages** (`index.html`, `landing-upload.html`):
   - `auth-check.js` runs on page load
   - Checks if user has a valid Supabase session
   - If no session → redirect to `login.html`
   - If session exists → allow access

3. **Logout**:
   - Click logout button
   - Session is cleared
   - Redirect to `login.html`

---

## Troubleshooting

### "Login failed: Invalid provider"
- Make sure GitHub OAuth is enabled in Supabase
- Check that Client ID and Secret are correctly entered

### "Authorization callback URL mismatch"
- Verify the callback URL in GitHub OAuth app is: `https://cgxjqsbrditbteqhdyus.supabase.co/auth/v1/callback`

### Stuck in redirect loop
- Clear browser cookies and cache
- Try in incognito/private mode
- Check browser console for errors

### Can't access admin pages
- Make sure you've added the auth scripts to the HTML files
- Check that the files are deployed to GitHub Pages
- Verify you're logged in by checking Supabase dashboard → Authentication → Users

---

## Security Notes

- Only users who authenticate via GitHub can access the admin panel
- Sessions expire after 1 hour of inactivity (Supabase default)
- You can restrict access to specific GitHub users by adding Row Level Security (RLS) policies in Supabase
- The public game URLs (`landing.html?deck=...`) remain publicly accessible

---

## Files Created

✅ `admin/config.js` - Supabase configuration
✅ `admin/auth.js` - Login logic for login.html
✅ `admin/auth-check.js` - Protection script for admin pages
✅ `admin/login.html` - Login page (already updated)

**Next steps**: Add auth scripts to `index.html` and `landing-upload.html` as shown in Step 2.
