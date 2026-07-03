# Raspberry Pi kiosk setup

Turns a Raspberry Pi 5 + touchscreen into the kitchen board.

## Recommended hardware

| Part | Recommendation |
|---|---|
| Computer | Raspberry Pi 5 (4 GB is plenty), official 27 W USB-C PSU |
| Storage | 32 GB A2 microSD (or an NVMe HAT if you want extra durability) |
| Display | 21–27" HDMI touchscreen with 10-point capacitive touch (e.g. ViewSonic TD2423/TD2455, Dell P2424HT). USB cable carries touch back to the Pi |
| Mounting | VESA wall mount or a countertop stand; a right-angle micro-HDMI adapter keeps it tidy |

## Setup

1. Flash **Raspberry Pi OS (64-bit, with desktop)** — Bookworm or newer — with Raspberry Pi Imager.
   In the Imager's settings, set the hostname/user and your Wi-Fi so it boots straight onto the network.
2. Boot, open a terminal (or SSH in), and run:

   ```bash
   git clone https://github.com/loggerhead-turtle/daily-tasks.git
   cd daily-tasks/pi
   sudo bash setup-kiosk.sh https://your-app.onrender.com
   sudo reboot
   ```

3. The Pi boots into the pairing screen. On your phone, open the parent site →
   **Settings → Pair the kitchen board**, generate a code, and type it on the Pi. Done.

## What the script locks down

- **Kiosk-only browsing**: a Chromium enterprise policy (`URLBlocklist: ["*"]` plus an
  allowlist for `/board` only) blocks navigation to any other website — including the
  parent web app. Kids physically cannot leave the board.
- No downloads, no devtools, no printing, no password manager, no profile switching.
- Screen blanking is disabled; the board's own photo screensaver takes over when idle.
- The browser relaunches automatically if it ever crashes, and starts on boot via
  desktop autologin.

## Day-2 operations

- **Everything is managed from the cloud** — chores, rewards, calendars, meals, photos,
  the PIN, even unpairing. You should never need a keyboard on the Pi again.
- **Updates**: the board is just a web page; deploys on Render show up on the next
  poll/refresh. The Pi itself only needs occasional `sudo apt update && sudo apt upgrade`.
- **Unpair/re-pair**: parent mode on the board (⚙️ → Unpair), or delete the board row
  and generate a new pairing code from Settings.
- **Nightly refresh (optional)**: some people like a 4 a.m. browser restart for a
  guaranteed fresh slate: `crontab -e` → `0 4 * * * pkill -f family-board-kiosk`.
  The autostart loop restarts it immediately.
