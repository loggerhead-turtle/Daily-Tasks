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
#   sudo bash setup-kiosk.sh https://your-app.onrender.com
#
set -euo pipefail

BOARD_URL="${1:-}"
if [[ -z "$BOARD_URL" ]]; then
  echo "Usage: sudo bash setup-kiosk.sh https://your-app.onrender.com"
  exit 1
fi
BOARD_URL="${BOARD_URL%/}"

KIOSK_USER="${SUDO_USER:-pi}"
KIOSK_HOME="$(eval echo "~$KIOSK_USER")"

echo "==> Installing packages"
apt-get update
apt-get install -y --no-install-recommends chromium-browser unclutter-xfixes || \
  apt-get install -y --no-install-recommends chromium unclutter-xfixes || true
CHROMIUM_BIN="$(command -v chromium-browser || command -v chromium)"

echo "==> Locking Chromium to the board (URL allowlist policy)"
# Navigation is blocked everywhere except the board app. The parent website
# is NOT allowed here on purpose — parents manage from their own devices.
mkdir -p /etc/chromium/policies/managed /etc/chromium-browser/policies/managed
cat > /etc/chromium/policies/managed/family-board-kiosk.json <<POLICY
{
  "URLBlocklist": ["*"],
  "URLAllowlist": ["${BOARD_URL}/board", "${BOARD_URL}/board/*"],
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

exec ${CHROMIUM_BIN} \\
  --kiosk "${BOARD_URL}/board" \\
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
sed -i '/family-board-kiosk/d' "$AUTOSTART"
cat >> "$AUTOSTART" <<AUTO
# Family Board kiosk — restart the browser forever if it exits
bash -c 'while true; do /usr/local/bin/family-board-kiosk; sleep 3; done' &
AUTO

# Fallback for X11 sessions (older Pi OS / raspi-config "X11" mode)
mkdir -p "$KIOSK_HOME/.config/lxsession/LXDE-pi"
XAUTOSTART="$KIOSK_HOME/.config/lxsession/LXDE-pi/autostart"
touch "$XAUTOSTART"
sed -i '/family-board-kiosk/d; /unclutter/d; /xset/d' "$XAUTOSTART"
cat >> "$XAUTOSTART" <<XAUTO
@xset s off
@xset -dpms
@xset s noblank
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
