# Setup guide

From zero to a working board in four steps: Supabase → Google → Render → Raspberry Pi.
Budget about 45 minutes. Everything fits in the free tiers except the ~$0 Render
hobby instance (free tier works too; it just sleeps and wakes a bit slowly).

## 1. Supabase (database, auth, storage)

1. Create a project at [supabase.com](https://supabase.com).
2. In **SQL Editor**, paste and run `supabase/migrations/0001_init.sql`.
3. (Recommended) Run `supabase/seed.sql` too — it creates a demo family so every
   screen has content: parent invite code `DEMO2026`, board pairing code `DEMO1234`,
   board parent PIN `1234`.
4. In **Authentication → Sign In / Up → Email**, turn **off** "Confirm email"
   (this app is for your own family; signup should work instantly).
5. From **Project Settings → API**, copy the Project URL, the `anon` key, and the
   `service_role` key for step 3.

## 2. Google Calendar OAuth

1. In [Google Cloud Console](https://console.cloud.google.com), create a project and
   enable the **Google Calendar API** (APIs & Services → Library).
2. **OAuth consent screen**: External, add both parents' Gmail addresses as test users
   (or publish the app if you prefer no 7-day token expiry — for personal use, adding
   test users and publishing to production with the read-only calendar scope is easiest).
3. **Credentials → Create credentials → OAuth client ID → Web application**:
   - Authorized redirect URI: `https://YOUR-APP-URL/api/google/callback`
4. Copy the Client ID and Client Secret for step 3.

## 3. Deploy to Render

1. Push this repo to GitHub (already done if you're reading it there).
2. On [render.com](https://render.com): **New → Blueprint**, pick this repo —
   `render.yaml` defines the service.
3. Fill in the environment variables when prompted (see `.env.example`):
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and
   `NEXT_PUBLIC_APP_URL` (the `https://….onrender.com` URL Render assigns — you can
   set it after the first deploy and redeploy).
4. Open the app → **Create account**. Either start a new family, or join the demo
   family with invite code `DEMO2026`.

Then in the parent app:
- **Family**: add your kids, pick their colors, upload their photos.
- **Chores / Rewards**: set up the routines and the prize catalog.
- **Calendars**: each parent clicks *Connect Google account*, then toggles on the
  calendars to show and assigns each one to a person (that's what makes the photo
  picker work on the board).
- **Settings**: set the parent PIN, the weather city, and generate a pairing code.

## 4. Raspberry Pi

See [`pi/README.md`](../pi/README.md). Short version:

```bash
git clone https://github.com/loggerhead-turtle/daily-tasks.git
cd daily-tasks/pi
sudo bash setup-kiosk.sh https://YOUR-APP.onrender.com
sudo reboot
```

Enter the pairing code from Settings, and the kitchen is in business.

## Local development

```bash
cp .env.example .env.local   # fill in your values; use http://localhost:3000 as APP_URL
npm install
npm run dev
```

- Parent app: http://localhost:3000 · Board: http://localhost:3000/board
- The board pairs against your real Supabase project (use `DEMO1234` if you seeded).

## Notes & troubleshooting

- **"Google did not return a refresh token"** — the account already granted access
  once. Remove the app at [myaccount.google.com/permissions](https://myaccount.google.com/permissions)
  and connect again.
- **Weather not showing** — set the city in Settings; the board fetches it via the
  server from Open-Meteo (no API key needed).
- **Board says "Invalid or expired code"** — codes expire after 15 minutes and are
  single-use; generate a fresh one.
- **Render free tier sleeping** — the board's 45-second polling keeps it awake during
  the day. If it sleeps overnight, the first morning touch takes ~30s to wake; the
  starter plan avoids this.
