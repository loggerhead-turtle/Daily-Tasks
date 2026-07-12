#!/usr/bin/env bash
#
# Family Board — Raspberry Pi 5 kiosk setup
#
# Turns a fresh Raspberry Pi OS (Bookworm, 64-bit, desktop) install into a
# locked-down kiosk that boots straight into the board:
#
#   • Chromium fullscreen kiosk pointed at your board URL
#   • Navigation locked to the board only (Chromium URL allowlist policy)
#   • Screen blanking disabled, cursor hidden when idle
#   • Auto-restart if the browser crashes; starts on boot
#
# Usage:
#   sudo bash setup-kiosk.sh https://your-board-url [https://your-project.supabase.co]
#
# The 2nd argument is your Supabase project URL (NEXT_PUBLIC_SUPABASE_URL).
# It's needed so the board can load avatars and screensaver photos; without it
# those images are blocked by the kiosk allowlist.
#
set -euo pipefail

BOARD_URL="${1:-}"
if [[ -z "$BOARD_URL" ]]; then
  echo "Usage: sudo bash setup-kiosk.sh https://your-board-url [https://your-project.supabase.co]"
  exit 1
fi
BOARD_URL="${BOARD_URL%/}"

SUPABASE_URL="${2:-}"
SUPABASE_HOST=""
if [[ -n "$SUPABASE_URL" ]]; then
  SUPABASE_HOST="$(echo "$SUPABASE_URL" | sed -E 's#^https?://##; s#/.*$##')"
else
  echo "WARNING: no Supabase URL given — avatars and screensaver photos will be"
  echo "         blocked. Re-run with your NEXT_PUBLIC_SUPABASE_URL as the 2nd arg."
fi

KIOSK_USER="${SUDO_USER:-pi}"
KIOSK_HOME="$(eval echo "~$KIOSK_USER")"

echo "==> Installing packages"
apt-get update
# fonts-noto-color-emoji is essential: without a color-emoji font every emoji on
# the board (member icons, chore/meal/weather glyphs) renders as an empty "tofu"
# box. Raspberry Pi OS does not ship one by default.
# swaybg paints a solid black background so the desktop never flashes before
# the board loads (see the autostart section below).
apt-get install -y --no-install-recommends chromium-browser unclutter-xfixes fonts-noto-color-emoji swaybg || \
  apt-get install -y --no-install-recommends chromium unclutter-xfixes fonts-noto-color-emoji swaybg || true
CHROMIUM_BIN="$(command -v chromium-browser || command -v chromium)"

# Rebuild the font cache so Chromium picks up the emoji font on first launch.
fc-cache -f >/dev/null 2>&1 || true

echo "==> Locking Chromium to the board (URL allowlist policy)"
# Everything is blocked except what the board actually needs:
#   /board        the kiosk page itself
#   /api          its data endpoints (state, events, chore/redeem actions)
#   /_next        the app's own JS/CSS/fonts (blank screen without this)
#   /favicon.ico  tab icon
#   <supabase>    avatars + screensaver photos
#   upload.wikimedia.org  the Starry Night screensaver painting (public domain)
# The parent-only pages (/, /settings, /login, …) are NOT allowlisted, so a
# kid cannot reach the management app from the board — and the rest of the
# internet stays blocked too.
SUPABASE_ALLOW=""
if [[ -n "$SUPABASE_HOST" ]]; then
  SUPABASE_ALLOW=", \"${SUPABASE_HOST}\""
fi
mkdir -p /etc/chromium/policies/managed /etc/chromium-browser/policies/managed
cat > /etc/chromium/policies/managed/family-board-kiosk.json <<POLICY
{
  "URLBlocklist": ["*"],
  "URLAllowlist": ["${BOARD_URL}/board", "${BOARD_URL}/api", "${BOARD_URL}/_next", "${BOARD_URL}/favicon.ico", "upload.wikimedia.org"${SUPABASE_ALLOW}],
  "IncognitoModeAvailability": 1,
  "BrowserAddPersonEnabled": false,
  "BookmarkBarEnabled": false,
  "DefaultPopupsSetting": 2,
  "DeveloperToolsAvailability": 2,
  "AllowFileSelectionDialogs": false,
  "PasswordManagerEnabled": false,
  "TranslateEnabled": false,
  "PrintingEnabled": false,
  "DownloadRestrictions": 3
}
POLICY
cp /etc/chromium/policies/managed/family-board-kiosk.json \
   /etc/chromium-browser/policies/managed/family-board-kiosk.json

echo "==> Creating kiosk launch script"
cat > /usr/local/bin/family-board-kiosk <<LAUNCH
#!/usr/bin/env bash
# Wait for the network so the board doesn't boot to an error page.
until ping -c1 -W2 8.8.8.8 >/dev/null 2>&1; do sleep 2; done

# --password-store=basic: on autologin there's no session password to unlock
# the GNOME keyring, so Chromium would otherwise pop a blocking "unlock keyring"
# dialog and never reach the board. This tells it to skip the system keyring.
exec ${CHROMIUM_BIN} \\
  --kiosk "${BOARD_URL}/board" \\
  --password-store=basic \\
  --noerrdialogs \\
  --disable-infobars \\
  --disable-session-crashed-bubble \\
  --disable-features=TranslateUI \\
  --disable-pinch \\
  --overscroll-history-navigation=0 \\
  --check-for-update-interval=31536000 \\
  --autoplay-policy=no-user-gesture-required \\
  --touch-events=enabled \\
  --ozone-platform-hint=auto
LAUNCH
chmod +x /usr/local/bin/family-board-kiosk

echo "==> Autostarting the kiosk on login (labwc / Wayland)"
mkdir -p "$KIOSK_HOME/.config/labwc"
AUTOSTART="$KIOSK_HOME/.config/labwc/autostart"
touch "$AUTOSTART"
sed -i '/family-board-kiosk/d; /swaybg/d' "$AUTOSTART"
cat >> "$AUTOSTART" <<AUTO
# Paint the screen black immediately so the desktop never shows before the board.
swaybg -c '#000000' >/dev/null 2>&1 &
# Family Board kiosk — restart the browser forever if it exits
bash -c 'while true; do /usr/local/bin/family-board-kiosk; sleep 3; done' &
AUTO

# Fallback for X11 sessions (older Pi OS / raspi-config "X11" mode)
mkdir -p "$KIOSK_HOME/.config/lxsession/LXDE-pi"
XAUTOSTART="$KIOSK_HOME/.config/lxsession/LXDE-pi/autostart"
touch "$XAUTOSTART"
sed -i '/family-board-kiosk/d; /unclutter/d; /xset/d; /xsetroot/d' "$XAUTOSTART"
cat >> "$XAUTOSTART" <<XAUTO
@xset s off
@xset -dpms
@xset s noblank
@xsetroot -solid black
@unclutter -idle 5
@bash -c 'while true; do /usr/local/bin/family-board-kiosk; sleep 3; done'
XAUTO

chown -R "$KIOSK_USER:$KIOSK_USER" "$KIOSK_HOME/.config"

echo "==> Disabling screen blanking"
raspi-config nonint do_blanking 1 || true

echo "==> Enabling desktop autologin"
raspi-config nonint do_boot_behaviour B4 || true

echo
echo "Done! Reboot to start the kiosk:  sudo reboot"
echo
echo "First boot shows the pairing screen — a parent generates the code at"
echo "${BOARD_URL}/settings (Settings → Pair the kitchen board)."
