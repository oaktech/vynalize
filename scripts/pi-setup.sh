#!/usr/bin/env bash
#
# Vynalize — Raspberry Pi 5 Setup
#
# Turns a fresh Raspberry Pi OS (Trixie) install into a dedicated
# visualizer appliance:
#   - Node.js server + built frontend
#   - Chromium kiosk on /display (auto-starts, full-screen, mic granted)
#   - mDNS so iPhone can reach http://vynalize.local:3001/remote
#
# Prerequisites:
#   - Raspberry Pi 5 (4GB+) running Raspberry Pi OS Trixie (64-bit)
#   - Internet connection (Wi-Fi or Ethernet)
#   - USB audio interface plugged in
#
# Usage:
#   curl -sL <raw-url>/scripts/pi-setup.sh | bash
#   — or —
#   git clone <repo> ~/vynalize && ~/vynalize/scripts/pi-setup.sh
#
set -euo pipefail

# ── Config ────────────────────────────────────────────────────
APP_DIR="${APP_DIR:-$HOME/vynalize}"
APP_PORT="${APP_PORT:-3001}"
KIOSK_URL="http://localhost:${APP_PORT}/display?autostart"
NODE_MAJOR=22
SERVICE_USER="$(whoami)"

info()  { echo -e "\033[1;34m[vynalize]\033[0m $*"; }
warn()  { echo -e "\033[1;33m[vynalize]\033[0m $*"; }
error() { echo -e "\033[1;31m[vynalize]\033[0m $*" >&2; }

# ── 1. System packages ───────────────────────────────────────
info "Updating system packages..."
sudo apt-get update -qq
sudo apt-get upgrade -y -qq

info "Installing dependencies..."
sudo apt-get install -y -qq \
  git \
  ffmpeg \
  chromium-browser \
  avahi-daemon \
  avahi-utils \
  libnss-mdns \
  labwc \
  alsa-utils

# ── 2. Node.js (via NodeSource) ──────────────────────────────
if ! command -v node &>/dev/null || [[ "$(node -v | cut -d. -f1 | tr -d v)" -lt "$NODE_MAJOR" ]]; then
  info "Installing Node.js ${NODE_MAJOR}..."
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | sudo -E bash -
  sudo apt-get install -y -qq nodejs
else
  info "Node.js $(node -v) already installed."
fi

# ── 3. Clone / update repo ───────────────────────────────────
if [[ -d "$APP_DIR/.git" ]]; then
  info "Updating existing repo in ${APP_DIR}..."
  git -C "$APP_DIR" pull --ff-only
else
  if [[ -d "$APP_DIR" ]]; then
    error "${APP_DIR} exists but is not a git repo. Aborting."
    exit 1
  fi
  info "Cloning repo to ${APP_DIR}..."
  git clone https://github.com/oaktech/vynalize.git "$APP_DIR"
fi

# ── 4. Build ──────────────────────────────────────────────────
info "Installing dependencies & building..."
cd "$APP_DIR"
npm install --workspaces --include-workspace-root
npm run build --workspace=packages/server
npm run build --workspace=packages/web

# ── 5. Environment file ──────────────────────────────────────
if [[ ! -f "$APP_DIR/.env" ]]; then
  info "Creating .env file (edit later to add API keys)..."
  cat > "$APP_DIR/.env" <<ENVEOF
PORT=${APP_PORT}
# YOUTUBE_API_KEY=your_key_here
ENVEOF
else
  info ".env already exists, skipping."
fi

# ── 6. USB audio — list devices ──────────────────────────────
info ""
info "Available audio input devices:"
echo "──────────────────────────────────────────"
arecord -l 2>/dev/null || true
echo "──────────────────────────────────────────"
info "Your USB audio interface should appear above."
info "The app selects the input device in the browser (Settings)."
info ""

# Set USB audio as default ALSA capture device if no .asoundrc exists
if [[ ! -f "$HOME/.asoundrc" ]]; then
  USB_CARD=$(arecord -l 2>/dev/null | grep -oP 'card \K[0-9]+' | head -1)
  if [[ -n "$USB_CARD" ]]; then
    info "Setting USB audio (card ${USB_CARD}) as default ALSA capture device..."
    cat > "$HOME/.asoundrc" <<ALSAEOF
pcm.!default {
    type asym
    playback.pcm "hw:0,0"
    capture.pcm "hw:${USB_CARD},0"
}
ctl.!default {
    type hw
    card ${USB_CARD}
}
ALSAEOF
  else
    warn "No USB audio device detected — plug in your USB mic and re-run setup."
  fi
else
  info ".asoundrc already exists, skipping ALSA config."
fi

# ── 7. Avahi / mDNS — vynalize.local ─────────────────────
info "Configuring mDNS hostname: vynalize.local"
AVAHI_CONF="/etc/avahi/avahi-daemon.conf"
if ! grep -q "host-name=vynalize" "$AVAHI_CONF" 2>/dev/null; then
  sudo sed -i "s/^host-name=.*/host-name=vynalize/" "$AVAHI_CONF" 2>/dev/null || true
  # If the line didn't exist, add it under [server]
  if ! grep -q "host-name=vynalize" "$AVAHI_CONF" 2>/dev/null; then
    sudo sed -i '/^\[server\]/a host-name=vynalize' "$AVAHI_CONF"
  fi
  sudo systemctl restart avahi-daemon
fi
info "iPhone can reach: http://vynalize.local:${APP_PORT}/remote"

# ── 8. Systemd service — Node server ─────────────────────────
info "Creating systemd service: vynalize.service"
sudo tee /etc/systemd/system/vynalize.service >/dev/null <<SVCEOF
[Unit]
Description=Vynalize Server
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=${SERVICE_USER}
WorkingDirectory=${APP_DIR}
ExecStart=$(command -v node) ${APP_DIR}/packages/server/dist/index.js
Environment=NODE_ENV=production
EnvironmentFile=${APP_DIR}/.env
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
SVCEOF

sudo systemctl daemon-reload
sudo systemctl enable vynalize.service
sudo systemctl restart vynalize.service
info "Server running on port ${APP_PORT}."

# ── 9. Chromium kiosk autostart ───────────────────────────────
info "Configuring Chromium kiosk autostart..."

# Kiosk launch script
KIOSK_SCRIPT="$HOME/kiosk.sh"
cat > "$KIOSK_SCRIPT" <<'KIOSKEOF'
#!/usr/bin/env bash
# Wait for server to be ready
for i in $(seq 1 30); do
  curl -sf "http://localhost:__PORT__/api/health" >/dev/null 2>&1 && break
  sleep 1
done

exec chromium-browser \
  --kiosk \
  --start-fullscreen \
  --incognito \
  --noerrdialogs \
  --disable-infobars \
  --disable-translate \
  --no-first-run \
  --disable-features=TranslateUI \
  --disable-pinch \
  --overscroll-history-navigation=0 \
  --disk-cache-dir=/dev/null \
  --autoplay-policy=no-user-gesture-required \
  --use-fake-ui-for-media-stream \
  --enable-features=OverlayScrollbar \
  --ozone-platform=wayland \
  "__URL__"
KIOSKEOF

# Replace placeholders
sed -i "s|__PORT__|${APP_PORT}|g" "$KIOSK_SCRIPT"
sed -i "s|__URL__|${KIOSK_URL}|g" "$KIOSK_SCRIPT"
chmod +x "$KIOSK_SCRIPT"

# Labwc autostart (Wayland compositor on Bookworm)
mkdir -p "$HOME/.config/labwc"
AUTOSTART="$HOME/.config/labwc/autostart"
if ! grep -q "kiosk.sh" "$AUTOSTART" 2>/dev/null; then
  echo "$KIOSK_SCRIPT" >> "$AUTOSTART"
fi

# ── 10. Boot config — auto-login to desktop ──────────────────
info "Configuring auto-login to desktop with labwc..."
# Use raspi-config non-interactively:
#   B4 = Desktop Autologin
sudo raspi-config nonint do_boot_behaviour B4 2>/dev/null || {
  warn "raspi-config failed — set Boot > Desktop Autologin manually via 'sudo raspi-config'."
}

# ── 11. GPU memory split ─────────────────────────────────────
# 256MB GPU is good for Chromium + canvas rendering
BOOT_CONFIG="/boot/firmware/config.txt"
if [[ -f "$BOOT_CONFIG" ]]; then
  if ! grep -q "^gpu_mem=" "$BOOT_CONFIG"; then
    info "Setting GPU memory to 256MB..."
    echo "gpu_mem=256" | sudo tee -a "$BOOT_CONFIG" >/dev/null
  fi
fi

# ── Done ──────────────────────────────────────────────────────
info ""
info "============================================"
info "  Vynalize — setup complete!"
info "============================================"
info ""
info "  Server:  http://localhost:${APP_PORT}"
info "  Display: ${KIOSK_URL}"
info "  Remote:  http://vynalize.local:${APP_PORT}/remote"
info ""
info "  Audio capture starts automatically on the display."
info ""
info "  To add YouTube video search, edit ~/.env:"
info "    YOUTUBE_API_KEY=your_key_here"
info ""
info "  Reboot now to start the kiosk:"
info "    sudo reboot"
info ""
