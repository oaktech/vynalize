# Vynalize — Raspberry Pi 5 Setup Guide

From a blank SD card to a self-booting visualizer kiosk.

---

## What you need

| Item | Notes |
|---|---|
| Raspberry Pi 5 (4 GB or 8 GB) | Pi 4 works but the 5 is noticeably smoother |
| MicroSD card — 16 GB+ | A2-rated cards give faster app launch |
| Official Pi 5 USB-C power supply | 5 V / 5 A — third-party supplies often under-spec |
| HDMI display | TV, monitor, or portable HDMI screen |
| Micro-HDMI → HDMI cable | The Pi 5 has two micro-HDMI ports; use the one labelled HDMI 0 |
| USB mic or USB audio interface | Any class-compliant USB audio input — e.g. a USB lavalier, Rode NT-USB Mini, or Behringer UCA222 |
| USB keyboard | Only needed during initial SSH or first-run troubleshooting |
| Ethernet cable or Wi-Fi credentials | Wi-Fi is configured during flashing |

---

## Step 1 — Flash the OS

1. Download **Raspberry Pi Imager** from [raspberrypi.com/software](https://www.raspberrypi.com/software/) and install it on your laptop or desktop.

2. Insert the MicroSD card.

3. Open Imager and make these selections:

   | Field | Value |
   |---|---|
   | Device | Raspberry Pi 5 |
   | Operating System | **Raspberry Pi OS (64-bit)** — the standard desktop build. Do not use the Lite image. |
   | Storage | your MicroSD card |

4. Click the **Edit Settings** (pencil) button and fill in:

   **General tab**

   | Setting | Recommended value |
   |---|---|
   | Hostname | `vynalize` |
   | Username | `pi` (or whatever you prefer) |
   | Password | choose a strong one |
   | Wi-Fi SSID / password | your home network (skip if using Ethernet) |
   | Wi-Fi country | your country code |
   | Locale / timezone | your region |

   **Services tab**

   - Enable SSH — **Use password authentication**

5. Click **Save**, then **Yes** to apply settings, then **Write**. Confirm the overwrite warning.

6. Wait for the write and verification to complete, then eject the card.

---

## Step 2 — First boot

1. Insert the MicroSD card into the Pi (bottom slot).
2. Plug in the USB microphone and the HDMI display.
3. Connect Ethernet if you're not using Wi-Fi.
4. Apply power via the USB-C cable.

The Pi will expand the filesystem on first boot and may reboot once automatically. Allow about 90 seconds before trying to connect.

---

## Step 3 — Connect to the Pi

From another machine on the same network:

```bash
ssh pi@vynalize.local
```

If mDNS isn't resolving yet, find the IP address from your router admin page and use that instead:

```bash
ssh pi@192.168.x.x
```

Alternatively, plug in a USB keyboard and open a terminal directly on the Pi.

---

## Step 4 — Run the setup script

```bash
git clone https://github.com/oaktech/vynalize.git ~/vynalize
~/vynalize/scripts/pi-setup.sh
```

The script is fully unattended. Grab a coffee — it takes a few minutes to download and compile everything. Here is what it does:

| Step | What happens |
|---|---|
| System packages | Installs `git`, `ffmpeg`, `chromium`, `labwc`, `avahi-daemon`, `alsa-utils` |
| Node.js 22 | Adds the NodeSource apt repository and installs Node 22 |
| Clone / pull | Clones the repo into `~/vynalize` (or pulls latest if already cloned) |
| Build | Runs `npm install` then builds the backend and frontend for production |
| `.env` | Creates `~/vynalize/.env` with `PORT=3001` if it doesn't already exist |
| ALSA | Detects the USB audio device and writes `~/.asoundrc` to set it as the default capture device |
| mDNS | Configures Avahi so the Pi is reachable at `vynalize.local` |
| systemd service | Creates and enables `vynalize.service` — the Node server starts at boot and restarts on crash |
| Chromium kiosk | Writes `~/kiosk.sh`, configures labwc autostart to launch it on login |
| Auto-login | Calls `raspi-config` to enable desktop auto-login |
| GPU memory | Sets `gpu_mem=256` in `/boot/firmware/config.txt` for smoother rendering |

At the end you will see a summary like:

```
[vynalize] ============================================
[vynalize]   Vynalize — setup complete!
[vynalize] ============================================

[vynalize]   Server:  http://localhost:3001
[vynalize]   Display: http://localhost:3001/kiosk?autostart
[vynalize]   Remote:  http://vynalize.local:3001/remote
```

---

## Step 5 — Optional: configure API keys

The app works without any API keys. Song identification (via Shazam), audio-reactive visualizations, and synced lyrics all work out of the box. A YouTube API key unlocks the music video mode.

```bash
nano ~/vynalize/.env
```

```env
PORT=3001

# Uncomment and fill in for music video mode:
# YOUTUBE_API_KEY=your_key_here

# Uncomment to skip the session-code pairing screen (good for standalone kiosks):
# REQUIRE_CODE=false
```

**Getting a free YouTube API key:**

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a project (or select an existing one)
3. Enable the **YouTube Data API v3**
4. Create an API key under **Credentials**
5. Paste it into `.env` as `YOUTUBE_API_KEY=AIza...`

---

## Step 6 — Reboot

```bash
sudo reboot
```

---

## What happens on every boot

| Order | Event |
|---|---|
| 1 | `vynalize.service` starts — Node.js server listens on port 3001 |
| 2 | User auto-logs into desktop; labwc Wayland compositor starts |
| 3 | `~/kiosk.sh` runs, polls `http://localhost:3001/api/health` until the server is ready (up to 30 s) |
| 4 | Chromium opens full-screen at `http://localhost:3001/kiosk?autostart` |
| 5 | The browser requests microphone access — pre-approved via `--use-fake-ui-for-media-stream` |
| 6 | Audio capture begins and the visualizer starts reacting to sound |

Once a song is recognized, the display switches to whatever mode is configured (visualizer, lyrics, video, or ASCII).

---

## Using the phone remote

Look at the top of the kiosk display for a QR code, or open from any device on the same network:

```
http://vynalize.local:3001/remote
```

The remote gives full control: display mode, visualizer selection, and sensitivity. If you set `REQUIRE_CODE=false` in `.env`, the remote connects directly without entering a pairing code.

---

## Maintenance

**Check server status:**

```bash
systemctl status vynalize
```

**Stream live server logs:**

```bash
journalctl -u vynalize -f
```

**Update to the latest version:**

```bash
cd ~/vynalize
git pull
npm install --workspaces --include-workspace-root
npm run build --workspace=packages/server
npm run build --workspace=packages/web
sudo systemctl restart vynalize
```

**Reconfigure after swapping the USB mic:**

```bash
rm ~/.asoundrc
~/vynalize/scripts/pi-setup.sh
```

---

## Troubleshooting

| Symptom | What to check |
|---|---|
| Black screen or desktop never appears | Run `systemctl status vynalize` — the server may have crashed on startup; check `journalctl -u vynalize` |
| Chromium shows an error page | The server may still be starting; wait 30 s, or check the logs above |
| "No USB audio device detected" during setup | Plug in the USB mic **before** running the setup script, then re-run it |
| Mic is detected but no songs are identified | Check ALSA config — run `arecord -l` to list cards, then verify `~/.asoundrc` points to the right card number |
| `ssh: Could not resolve hostname vynalize.local` | mDNS takes a moment after first boot; use the IP address directly, or wait and retry |
| Chromium not launching full-screen | Confirm `do_boot_behaviour B4` succeeded: run `sudo raspi-config`, go to System Options → Boot / Auto Login → Desktop Autologin |
| YouTube video mode not available | Add `YOUTUBE_API_KEY` to `~/vynalize/.env` and restart with `sudo systemctl restart vynalize` |
