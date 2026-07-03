# 🏠 Family Board

A touch-first kitchen display for the whole family — the week's schedule, each kid's
chores, and a points-and-prizes reward system — plus a parent web app to run it all
from anywhere.

- **Kitchen board** (`/board`): runs fullscreen on a Raspberry Pi 5 + touchscreen.
  Playful and colorful, built for small fingers: kids tap their own photo to see
  their jobs, tap a chore to mark it done (confetti included 🎉), and browse the
  family calendar by tapping faces. Also shows clock + weather, tonight's dinner,
  parent announcements, and turns into a photo frame when idle.
- **Parent app** (`/`): mom or dad sign in from any phone or laptop to add chores
  (recurring, weekly-rotating between siblings, one-offs, and bonus "up for grabs"
  jobs), manage the prize catalog, approve completed chores and reward requests,
  connect Google Calendars, and manage the board itself — all from the cloud.

## How the family uses it

1. A parent creates chores and rewards on the website.
2. Chores appear automatically on the board on their scheduled days. Kids tap their
   face → tap a job done → it goes to "waiting for 👍".
3. A parent approves from their phone (or the ⚙️ PIN-locked parent mode on the board);
   points land in the kid's balance with a celebration.
4. Kids browse the prize catalog and request rewards with their points; parents grant them.
5. Everyone's Google Calendars show on the board, read-only, filterable by tapping a
   family member's photo — or the 👨‍👩‍👧‍👦 "Everyone" bubble.

## Architecture

```
┌─────────────────────┐        ┌──────────────────────────────┐
│  Raspberry Pi 5     │        │  Render (Next.js app)        │
│  Chromium kiosk     │◄──────►│   /board     kiosk UI        │
│  URL-allowlisted    │  poll  │   /          parent web app  │
│  to /board only     │        │   /api/board device API      │
└─────────────────────┘        │   /api/...   parent + OAuth  │
                               └──────┬─────────────┬─────────┘
┌─────────────────────┐               │             │
│  Parents' phones    │◄──────────────┘             ▼
│  (parent web app)   │        ┌──────────────┐  ┌────────────────┐
└─────────────────────┘        │  Supabase    │  │ Google         │
                               │  Postgres    │  │ Calendar API   │
                               │  Auth        │  │ (read-only     │
                               │  Storage     │  │  per parent)   │
                               └──────────────┘  └────────────────┘
```

- **Board auth**: the kiosk pairs once with a short code and holds a device token —
  no user accounts on the board, ever. Parent mode on the board is a 4–6 digit PIN
  that only unlocks approvals and unpairing.
- **Kiosk lockdown**: a Chromium enterprise policy on the Pi blocks navigation to
  everything except `/board`. See [`pi/`](pi/).
- **Calendars**: each parent connects their own Google account (read-only scope);
  the server stores refresh tokens and merges events for the board.
- **Chore engine**: chores are definitions (daily / chosen weekdays / one-time, with
  fixed, weekly-rotating, or up-for-grabs assignment); day instances materialize
  automatically and deterministically — rotation follows the ISO week number.

## Repo tour

| Path | What |
|---|---|
| `src/app/board/` + `src/components/board/` | The kitchen board UI |
| `src/app/(parent)/` | Parent web app (dashboard, chores, rewards, family, calendars, content, settings) |
| `src/app/api/board/` | Device-token API the board talks to |
| `src/app/api/google/` | Google Calendar OAuth |
| `src/lib/` | Chore engine, Google client, auth helpers, types |
| `supabase/` | Database schema (with RLS) + demo seed data |
| `pi/` | Raspberry Pi kiosk setup script + hardware guide |
| `docs/SETUP.md` | Step-by-step deployment guide |

## Quick start

Follow [docs/SETUP.md](docs/SETUP.md). Short version: create a Supabase project and run
the two SQL files, create a Google OAuth client, deploy to Render with `render.yaml`,
then run `pi/setup-kiosk.sh` on the Pi. The seed ships a demo family (invite code
`DEMO2026`, board pairing code `DEMO1234`, parent PIN `1234`) so every screen looks
alive before you add your own crew.
