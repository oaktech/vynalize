#!/usr/bin/env bash
#
# Vynalize — Raspberry Pi 5 Setup
#
# Turns a fresh Raspberry Pi OS (Trixie) install into a dedicated
# visualizer appliance:
#   - Node.js server + built frontend
#   - Chromium kiosk on /kiosk (auto-starts, full-screen, mic granted)
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
KIOSK_URL="http://localhost:${APP_PORT}/kiosk?autostart"
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
  chromium \
  avahi-daemon \
  avahi-utils \
  libnss-mdns \
  labwc \
  alsa-utils \
  pipewire \
  wireplumber

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

# ── 5. OTA update directory layout ───────────────────────────
SHARED_DIR="${APP_DIR}/shared"
RELEASES_DIR="${APP_DIR}/releases"
DOWNLOADS_DIR="${APP_DIR}/downloads"
SCRIPTS_DEST="${APP_DIR}/scripts"
INITIAL_VERSION="v0.1.0"

info "Setting up OTA update directory layout..."
mkdir -p "$SHARED_DIR" "$RELEASES_DIR" "$DOWNLOADS_DIR" "$SCRIPTS_DEST"

# Move .env to shared/ (or create it there)
if [[ -f "$APP_DIR/.env" && ! -L "$APP_DIR/.env" ]]; then
  mv "$APP_DIR/.env" "$SHARED_DIR/.env"
elif [[ ! -f "$SHARED_DIR/.env" ]]; then
  cat > "$SHARED_DIR/.env" <<ENVEOF
PORT=${APP_PORT}
# YOUTUBE_API_KEY=your_key_here
ENVEOF
fi

# Move settings.json to shared/ (or create default)
if [[ -f "$APP_DIR/settings.json" && ! -L "$APP_DIR/settings.json" ]]; then
  mv "$APP_DIR/settings.json" "$SHARED_DIR/settings.json"
elif [[ ! -f "$SHARED_DIR/settings.json" ]]; then
  echo '{}' > "$SHARED_DIR/settings.json"
fi

# Package the built app into an initial release
RELEASE_DIR="${RELEASES_DIR}/${INITIAL_VERSION}"
if [[ ! -d "$RELEASE_DIR" ]]; then
  info "Creating initial release ${INITIAL_VERSION}..."
  mkdir -p "$RELEASE_DIR"

  echo "${INITIAL_VERSION#v}" > "$RELEASE_DIR/VERSION"
  cp "$APP_DIR/package.json" "$RELEASE_DIR/"
  cp -r "$APP_DIR/node_modules" "$RELEASE_DIR/"
  cp -r "$APP_DIR/packages" "$RELEASE_DIR/"

  # Symlink shared files into the release
  ln -sfn "$SHARED_DIR/.env" "$RELEASE_DIR/.env"
  ln -sfn "$SHARED_DIR/settings.json" "$RELEASE_DIR/settings.json"
fi

# Create current symlink
ln -sfn "$RELEASE_DIR" "${APP_DIR}/current"
info "Active release: ${APP_DIR}/current -> ${RELEASE_DIR}"

# Initialize update.json
if [[ ! -f "$SHARED_DIR/update.json" ]]; then
  cat > "$SHARED_DIR/update.json" <<UJEOF
{
  "currentVersion": "${INITIAL_VERSION#v}",
  "updateAvailable": null,
  "status": "idle",
  "lastCheck": null,
  "lastUpdate": null,
  "channel": "stable",
  "error": null
}
UJEOF
fi

# Install updater script
cp "${APP_DIR}/scripts/vynalize-updater.sh" "$SCRIPTS_DEST/vynalize-updater.sh"
chmod +x "$SCRIPTS_DEST/vynalize-updater.sh"

# ── 6. USB audio — PipeWire + ALSA ───────────────────────────
# Pi OS Trixie uses PipeWire as the default audio server.
# Chromium (Wayland) talks to PipeWire, not raw ALSA, so we
# need to set the default *PipeWire* source via WirePlumber.
info ""
info "Available audio input devices:"
echo "──────────────────────────────────────────"
arecord -l 2>/dev/null || true
echo "──────────────────────────────────────────"

# Ensure PipeWire + WirePlumber are running for this user session
systemctl --user enable --now pipewire pipewire-pulse wireplumber 2>/dev/null || true

# Find the USB audio source in PipeWire and set it as default
USB_PW_SOURCE=$(wpctl status 2>/dev/null \
  | sed -n '/Audio/,/Video/p' \
  | sed -n '/Sources:/,/Sinks\|Filters\|Streams/p' \
  | grep -i 'usb\|audio' \
  | grep -oP '^\s*\K[0-9]+' \
  | head -1)

if [[ -n "$USB_PW_SOURCE" ]]; then
  info "Setting PipeWire default source to USB device (id ${USB_PW_SOURCE})..."
  wpctl set-default "$USB_PW_SOURCE"
else
  # PipeWire may not be running yet (first boot). Create a WirePlumber
  # rule that auto-selects USB audio as default source on future boots.
  info "PipeWire not yet active — creating WirePlumber rule for USB audio..."
fi

# Always write the WirePlumber rule so USB mic is default on every boot
WP_RULES_DIR="$HOME/.config/wireplumber/wireplumber.conf.d"
mkdir -p "$WP_RULES_DIR"
cat > "$WP_RULES_DIR/50-usb-mic-default.conf" <<'WPEOF'
monitor.alsa.rules = [
  {
    matches = [
      { device.name = "~alsa_input.usb-*" }
    ]
    actions = {
      update-props = {
        node.name = "usb-mic"
        priority.session = 2000
      }
    }
  }
]
WPEOF

# Also keep ALSA fallback for non-PipeWire apps
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
  fi
fi

info "USB audio configured for PipeWire + ALSA."
info ""

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
WorkingDirectory=${APP_DIR}/current
ExecStart=$(command -v node) ${APP_DIR}/current/packages/server/dist/index.js
Environment=NODE_ENV=production
EnvironmentFile=${APP_DIR}/shared/.env
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
SVCEOF

# ── 8b. Systemd timer — OTA updater ─────────────────────────
info "Creating systemd timer: vynalize-updater"
sudo tee /etc/systemd/system/vynalize-updater.service >/dev/null <<USVCEOF
[Unit]
Description=Vynalize OTA Updater
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
User=${SERVICE_USER}
ExecStart=${APP_DIR}/scripts/vynalize-updater.sh auto
StandardOutput=journal
StandardError=journal
USVCEOF

sudo tee /etc/systemd/system/vynalize-updater.timer >/dev/null <<UTMREOF
[Unit]
Description=Vynalize daily update check

[Timer]
OnCalendar=*-*-* 03:00:00
RandomizedDelaySec=7200
Persistent=true

[Install]
WantedBy=timers.target
UTMREOF

# ── 8c. Sudoers — passwordless service restart ──────────────
info "Configuring sudoers for passwordless service restart..."
sudo tee /etc/sudoers.d/vynalize-update >/dev/null <<SUDEOF
# Allow the vynalize user to restart the service without a password
${SERVICE_USER} ALL=(ALL) NOPASSWD: /usr/bin/systemctl restart vynalize.service
SUDEOF
sudo chmod 440 /etc/sudoers.d/vynalize-update

sudo systemctl daemon-reload
sudo systemctl enable vynalize.service
sudo systemctl enable vynalize-updater.timer
sudo systemctl start vynalize-updater.timer
sudo systemctl restart vynalize.service
info "Server running on port ${APP_PORT}."
info "Update timer enabled (daily 3-5 AM)."

# ── 9. Chromium kiosk autostart ───────────────────────────────
info "Configuring Chromium kiosk autostart..."

# Kiosk launch script
KIOSK_SCRIPT="$HOME/kiosk.sh"
cat > "$KIOSK_SCRIPT" <<'KIOSKEOF'
#!/usr/bin/env bash
# Ensure PipeWire is running (Chromium needs it for mic access)
systemctl --user start pipewire pipewire-pulse wireplumber 2>/dev/null || true

# Wait for server to be ready
for i in $(seq 1 30); do
  curl -sf "http://localhost:__PORT__/api/health" >/dev/null 2>&1 && break
  sleep 1
done

exec chromium \
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
  --disk-cache-dir=/tmp/chromium-cache \
  --autoplay-policy=no-user-gesture-required \
  --use-fake-ui-for-media-stream \
  --enable-features=OverlayScrollbar,CanvasOopRasterization \
  --enable-gpu-rasterization \
  --enable-accelerated-2d-canvas \
  --ignore-gpu-blocklist \
  --enable-zero-copy \
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
info "  To add YouTube video search, edit ~/vynalize/shared/.env:"
info "    YOUTUBE_API_KEY=your_key_here"
info ""
info "  Reboot now to start the kiosk:"
info "    sudo reboot"
info ""
