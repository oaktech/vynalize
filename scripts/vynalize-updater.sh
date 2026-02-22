#!/usr/bin/env bash
#
# Vynalize OTA Updater
#
# Standalone update daemon for Vynalize appliances.
# Designed to survive broken app deployments — if the Node app won't start,
# this script can still roll back to the previous version.
#
# Usage:
#   vynalize-updater.sh auto       Full update cycle (check → download → install → verify)
#   vynalize-updater.sh check      Check for updates, write result to update.json
#   vynalize-updater.sh download   Download latest release (resume-capable)
#   vynalize-updater.sh install    Install a downloaded release
#   vynalize-updater.sh rollback   Roll back to the previous version
#
set -euo pipefail

# ── Configuration ────────────────────────────────────────────
VYNALIZE_HOME="${VYNALIZE_HOME:-$HOME/vynalize}"
REPO="oaktech/vynalize"
GITHUB_API="https://api.github.com/repos/${REPO}/releases"
HEALTH_URL="http://localhost:3001/api/health"
HEALTH_TIMEOUT=60
MAX_RELEASES=3

RELEASES_DIR="${VYNALIZE_HOME}/releases"
SHARED_DIR="${VYNALIZE_HOME}/shared"
DOWNLOADS_DIR="${VYNALIZE_HOME}/downloads"
CURRENT_LINK="${VYNALIZE_HOME}/current"
PREVIOUS_LINK="${VYNALIZE_HOME}/previous"
UPDATE_JSON="${SHARED_DIR}/update.json"
UPDATE_LOG="${SHARED_DIR}/update.log"
SCRIPTS_DIR="${VYNALIZE_HOME}/scripts"

# ── Logging ──────────────────────────────────────────────────
log() {
  local msg
  msg="[$(date '+%Y-%m-%d %H:%M:%S')] $*"
  echo "$msg"

  # Append to rolling log (cap at 500 lines)
  if [[ -f "$UPDATE_LOG" ]]; then
    echo "$msg" >> "$UPDATE_LOG"
    tail -n 500 "$UPDATE_LOG" > "${UPDATE_LOG}.tmp" && mv "${UPDATE_LOG}.tmp" "$UPDATE_LOG"
  fi
}

die() {
  log "ERROR: $*"
  update_state status error error "$*"
  exit 1
}

# ── State management (shared/update.json) ────────────────────
# Reads a field from update.json. Falls back to a default if missing.
# Values are passed via environment variables to avoid shell injection.
read_state() {
  local field="$1" default="${2:-}"
  if [[ -f "$UPDATE_JSON" ]]; then
    local val
    val=$(UJ_PATH="$UPDATE_JSON" UJ_FIELD="$field" UJ_DEFAULT="$default" python3 - <<'PYEOF'
import json, os
try:
    d = json.load(open(os.environ['UJ_PATH']))
    print(d.get(os.environ['UJ_FIELD'], os.environ['UJ_DEFAULT']))
except:
    print(os.environ['UJ_DEFAULT'])
PYEOF
    )
    echo "${val:-$default}"
  else
    echo "$default"
  fi
}

# Updates one or two fields in update.json atomically.
update_state() {
  local key1="$1" val1="$2" key2="${3:-}" val2="${4:-}"
  UJ_PATH="$UPDATE_JSON" UJ_KEY1="$key1" UJ_VAL1="$val1" \
  UJ_KEY2="$key2" UJ_VAL2="$val2" python3 - <<'PYEOF'
import json, os
path = os.environ['UJ_PATH']
try:
    d = json.load(open(path))
except:
    d = {}
d[os.environ['UJ_KEY1']] = os.environ['UJ_VAL1']
key2 = os.environ.get('UJ_KEY2', '')
if key2:
    d[key2] = os.environ['UJ_VAL2']
os.makedirs(os.path.dirname(path), exist_ok=True)
tmp = path + '.tmp'
with open(tmp, 'w') as f:
    json.dump(d, f, indent=2)
    f.write('\n')
os.rename(tmp, path)
PYEOF
}

# ── Version helpers ──────────────────────────────────────────
current_version() {
  if [[ -L "$CURRENT_LINK" && -f "$CURRENT_LINK/VERSION" ]]; then
    cat "$CURRENT_LINK/VERSION"
  else
    echo "0.0.0"
  fi
}

# Compare versions using sort -V. Returns 0 if $1 < $2.
version_lt() {
  [[ "$1" != "$2" ]] && [[ "$(printf '%s\n%s' "$1" "$2" | sort -V | head -n1)" == "$1" ]]
}

# ── GitHub API ───────────────────────────────────────────────
fetch_latest_release() {
  local channel
  channel=$(read_state channel stable)

  local url="${GITHUB_API}/latest"
  if [[ "$channel" == "beta" ]]; then
    # For beta channel, list all releases and pick the first (newest)
    url="${GITHUB_API}?per_page=1"
  fi

  local response
  response=$(curl -sf -H "Accept: application/vnd.github+json" "$url" 2>/dev/null) || {
    log "Failed to fetch release info from GitHub"
    return 1
  }

  if [[ "$channel" == "beta" ]]; then
    # Response is an array — extract the first element
    response=$(echo "$response" | python3 -c "import json,sys; print(json.dumps(json.load(sys.stdin)[0]))" 2>/dev/null) || {
      log "Failed to parse beta release list"
      return 1
    }
  fi

  echo "$response"
}

parse_release_tag() {
  echo "$1" | python3 -c "import json,sys; print(json.load(sys.stdin).get('tag_name',''))" 2>/dev/null
}

parse_release_version() {
  local tag
  tag=$(parse_release_tag "$1")
  echo "${tag#v}"
}

parse_asset_url() {
  local suffix="$2"
  echo "$1" | UJ_SUFFIX="$suffix" python3 -c "
import json, sys, os
data = json.load(sys.stdin)
suffix = os.environ['UJ_SUFFIX']
for asset in data.get('assets', []):
    if asset['name'].endswith(suffix):
        print(asset['browser_download_url'])
        break
" 2>/dev/null
}

# ── Subcommands ──────────────────────────────────────────────

cmd_check() {
  log "Checking for updates..."
  update_state status checking

  local release
  release=$(fetch_latest_release) || {
    update_state status error error "Failed to reach GitHub"
    return 1
  }

  local remote_version
  remote_version=$(parse_release_version "$release")
  local local_version
  local_version=$(current_version)

  update_state lastCheck "$(date -u '+%Y-%m-%dT%H:%M:%SZ')"

  if version_lt "$local_version" "$remote_version"; then
    log "Update available: v${local_version} → v${remote_version}"
    update_state status idle updateAvailable "$remote_version"
    return 0
  else
    log "Already up to date (v${local_version})"
    update_state status idle updateAvailable ""
    return 1
  fi
}

cmd_download() {
  log "Downloading latest release..."
  update_state status downloading

  local release
  release=$(fetch_latest_release) || die "Failed to fetch release info"

  local tag
  tag=$(parse_release_tag "$release")
  local version
  version=$(parse_release_version "$release")

  # Skip if already installed
  if [[ -d "${RELEASES_DIR}/${tag}" ]]; then
    log "Release ${tag} already exists locally"
    return 0
  fi

  local tarball_url checksum_url
  tarball_url=$(parse_asset_url "$release" "-arm64.tar.gz")
  checksum_url=$(parse_asset_url "$release" "-arm64.tar.gz.sha256")

  if [[ -z "$tarball_url" ]]; then
    die "No tarball found in release ${tag}"
  fi

  mkdir -p "$DOWNLOADS_DIR"
  local tarball="${DOWNLOADS_DIR}/vynalize-${tag}-arm64.tar.gz"
  local checksum_file="${DOWNLOADS_DIR}/vynalize-${tag}-arm64.tar.gz.sha256"

  # Resume-capable download
  log "Downloading ${tarball_url}..."
  curl -fL -C - -o "$tarball" "$tarball_url" || die "Download failed"

  # Download checksum
  if [[ -n "$checksum_url" ]]; then
    curl -fL -o "$checksum_file" "$checksum_url" || die "Checksum download failed"

    # Verify SHA-256
    log "Verifying checksum..."
    local expected actual
    expected=$(awk '{print $1}' "$checksum_file")
    actual=$(sha256sum "$tarball" | awk '{print $1}')
    if [[ "$expected" != "$actual" ]]; then
      rm -f "$tarball" "$checksum_file"
      die "Checksum mismatch! Expected: ${expected}, Got: ${actual}"
    fi
    log "Checksum verified"
  else
    log "Warning: no checksum file found, skipping verification"
  fi

  log "Download complete: ${tarball}"
}

cmd_install() {
  log "Installing update..."
  update_state status installing

  # Find the downloaded tarball
  local release
  release=$(fetch_latest_release) || die "Failed to fetch release info"
  local tag
  tag=$(parse_release_tag "$release")
  local version
  version=$(parse_release_version "$release")
  local tarball="${DOWNLOADS_DIR}/vynalize-${tag}-arm64.tar.gz"
  local release_dir="${RELEASES_DIR}/${tag}"

  if [[ -d "$release_dir" ]]; then
    # Release already extracted (e.g. re-update after rollback) — skip extraction
    log "Release ${tag} already extracted, skipping to install"
  elif [[ -f "$tarball" ]]; then
    # Extract to temp dir, then move into place
    local tmp_dir="${RELEASES_DIR}/.tmp-${tag}"
    rm -rf "$tmp_dir"
    mkdir -p "$tmp_dir"

    log "Extracting to ${release_dir}..."
    tar -xzf "$tarball" -C "$tmp_dir" --strip-components=1

    # Create symlinks to shared config inside the release
    ln -sfn "${SHARED_DIR}/.env" "${tmp_dir}/.env"
    ln -sfn "${SHARED_DIR}/settings.json" "${tmp_dir}/settings.json"

    # Move extracted dir to final location
    rm -rf "$release_dir"
    mv "$tmp_dir" "$release_dir"
  else
    die "No downloaded tarball found for ${tag}. Run 'download' first."
  fi

  # Update previous symlink to current (before swapping)
  if [[ -L "$CURRENT_LINK" ]]; then
    local current_target
    current_target=$(readlink "$CURRENT_LINK")
    ln -sfn "$current_target" "$PREVIOUS_LINK"
  fi

  # Atomic symlink swap (mv -T is GNU coreutils — Linux/Pi only)
  local tmp_link="${VYNALIZE_HOME}/.current-swap"
  ln -sfn "$release_dir" "$tmp_link"
  mv -T "$tmp_link" "$CURRENT_LINK"

  log "Symlink swapped: current -> ${release_dir}"

  # Restart the service
  log "Restarting vynalize.service..."
  sudo systemctl restart vynalize.service

  # Health check
  log "Waiting for health check (${HEALTH_TIMEOUT}s timeout)..."
  local healthy=false
  for i in $(seq 1 "$HEALTH_TIMEOUT"); do
    if curl -sf "$HEALTH_URL" >/dev/null 2>&1; then
      healthy=true
      break
    fi
    sleep 1
  done

  if $healthy; then
    log "Health check passed — v${version} is live!"
    update_state status idle updateAvailable ""
    update_state currentVersion "$version" lastUpdate "$(date -u '+%Y-%m-%dT%H:%M:%SZ')"

    # Clean up download
    rm -f "$tarball" "${tarball}.sha256"

    # Prune old releases (keep the newest MAX_RELEASES)
    prune_releases

    # Self-update the updater script if a newer one exists in the release
    self_update
  else
    log "Health check FAILED — rolling back!"
    cmd_rollback
    die "Update to v${version} failed health check; rolled back"
  fi
}

cmd_rollback() {
  log "Rolling back to previous version..."

  if [[ ! -L "$PREVIOUS_LINK" ]]; then
    die "No previous version to roll back to"
  fi

  local prev_target
  prev_target=$(readlink "$PREVIOUS_LINK")
  if [[ ! -d "$prev_target" ]]; then
    die "Previous release directory does not exist: ${prev_target}"
  fi

  # Atomic symlink swap back to previous (mv -T is GNU coreutils — Linux/Pi only)
  local tmp_link="${VYNALIZE_HOME}/.current-swap"
  ln -sfn "$prev_target" "$tmp_link"
  mv -T "$tmp_link" "$CURRENT_LINK"

  log "Rolled back: current -> ${prev_target}"
  sudo systemctl restart vynalize.service

  # Brief health check for rollback
  sleep 5
  if curl -sf "$HEALTH_URL" >/dev/null 2>&1; then
    log "Rollback successful — service is healthy"
    local version
    version=$(cat "${prev_target}/VERSION" 2>/dev/null || echo "unknown")
    update_state status idle currentVersion "$version"
  else
    log "WARNING: Service unhealthy even after rollback"
    update_state status error error "Unhealthy after rollback"
  fi
}

cmd_auto() {
  log "=== Starting auto-update cycle ==="

  # Check for updates (returns 1 if already up-to-date)
  if ! cmd_check; then
    log "No update needed."
    return 0
  fi

  cmd_download
  cmd_install

  log "=== Auto-update cycle complete ==="
}

# ── Helpers ──────────────────────────────────────────────────

prune_releases() {
  local count
  count=$(find "$RELEASES_DIR" -maxdepth 1 -mindepth 1 -type d | wc -l)
  if [[ "$count" -le "$MAX_RELEASES" ]]; then
    return
  fi

  log "Pruning old releases (keeping ${MAX_RELEASES})..."

  # Get current and previous targets to protect them
  local keep_current="" keep_previous=""
  [[ -L "$CURRENT_LINK" ]] && keep_current=$(readlink -f "$CURRENT_LINK")
  [[ -L "$PREVIOUS_LINK" ]] && keep_previous=$(readlink -f "$PREVIOUS_LINK")

  # Sort release dirs by version, remove oldest
  find "$RELEASES_DIR" -maxdepth 1 -mindepth 1 -type d -printf '%f\n' \
    | sort -V \
    | head -n -"$MAX_RELEASES" \
    | while read -r dir; do
        local full="${RELEASES_DIR}/${dir}"
        full=$(readlink -f "$full")
        if [[ "$full" == "$keep_current" || "$full" == "$keep_previous" ]]; then
          continue
        fi
        log "Removing old release: ${dir}"
        rm -rf "${RELEASES_DIR}/${dir}"
      done
}

self_update() {
  local new_updater="${CURRENT_LINK}/scripts/vynalize-updater.sh"
  if [[ -f "$new_updater" ]]; then
    local installed="${SCRIPTS_DIR}/vynalize-updater.sh"
    if ! cmp -s "$new_updater" "$installed" 2>/dev/null; then
      log "Updating updater script..."
      cp "$new_updater" "$installed"
      chmod +x "$installed"
    fi
  fi
}

# ── Main ─────────────────────────────────────────────────────
mkdir -p "$RELEASES_DIR" "$SHARED_DIR" "$DOWNLOADS_DIR"
touch "$UPDATE_LOG"

case "${1:-auto}" in
  auto)     cmd_auto ;;
  check)    cmd_check || true ;;  # exit 0 even if up-to-date (for systemd timer)
  download) cmd_download ;;
  install)  cmd_install ;;
  rollback) cmd_rollback ;;
  *)
    echo "Usage: $(basename "$0") {auto|check|download|install|rollback}"
    exit 1
    ;;
esac
