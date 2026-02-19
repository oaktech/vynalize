# Features

## Audio Capture & Analysis

- Microphone-based audio capture via Web Audio API (`getUserMedia`)
- Raw audio mode: echo cancellation, noise suppression, and auto gain all disabled for faithful signal
- Real-time FFT frequency analysis (2048-point), throttled to ~30fps to reduce CPU/GC pressure
- Reuses typed arrays across frames to minimize garbage collection
- Extracted features: RMS, energy, spectral centroid, spectral flux, zero crossing rate, bass/mid/high band energies

## Song Identification

- Shazam-powered recognition via node-shazam -- designed for ambient/room audio
- Automatic identification from microphone capture every 20 seconds
- Returns title, artist, album, and album art directly from Shazam
- No API key required for song identification
- Manual search fallback via MusicBrainz (type artist + title directly)
- Album artwork from Shazam or Cover Art Archive (manual search)
- Periodic re-identification to detect track changes
- Animated listening indicator that pulses with audio energy

## Visualizer Modes

Twelve built-in visualizations, all reactive to live audio:

### Spectrum Bars
- 64-bar frequency spectrum with rounded tops
- Accent color gradients with beat-triggered flash
- Subtle reflection effect below the bars

### Radial Spectrum
- 128-bar circular frequency display
- Inner and outer bars radiating from a glowing center
- Rotation speed driven by detected BPM
- Pulse scaling on beats

### Particle Field (3D)
- 2,000 particles in a spherical distribution
- Bass drives radial expansion, mid drives orbital rotation, high drives vertical oscillation
- Beat events cause burst expansion
- Particles colored by accent color with additive blending

### Radical
- Neon kaleidoscopic patterns: starburst, rings, zigzag, diamond, grid, and bolt shapes
- Color-shifting transitions with hypnotic rotation on beat
- Glow intensifies with audio energy

### Nebula
- Cosmic eye-like entity with animated iris and responsive pupil dilation
- Star field background with aurora ribbons and orbiting particles
- Parallax depth effect driven by audio features

### Vitals
- Hospital ECG monitor aesthetic with multi-line scrolling traces
- ECG, plethysmography, respiration, and capnography (CO₂) channels
- Digital biometric readouts (HR, SpO₂, RESP, EtCO₂) modulated by audio

### Synthwave
- Retro 80s landscape with perspective grid floor
- Jagged mountain silhouettes and shooting stars
- Sun with horizontal scan lines rising above the horizon

### Space Age
- Four-panel sci-fi diorama layout
- Rocket launch with particle exhaust, comet with satellite dishes
- Eclipse with corona rays, black hole with accretion disk and jets

### Starry Night
- Van Gogh-inspired impressionist scene
- Swirling vortex brushstrokes and concentric star halos
- Crescent moon, rolling hills, village buildings, and cypress tree

### Guitar Hero
- Simulated rhythm game with 5-lane perspective highway
- Frequency bands drive note spawning across sub-bass, bass, mid, high-mid, and treble lanes
- Per-lane gain compensation for spectral rolloff so all lanes feel equally active
- Notes scroll toward a strikeline with simulated hit detection and scoring
- Missed notes scroll past the strikeline and fade out; hit notes freeze and burst
- Note streak (every hit) and combo (every 5 hits) system with multiplier milestones (2x/3x/4x)
- Longest streak tracker persists per song
- Per-lane combo flames that intensify with streak length
- Hit beams — colored laser columns shoot upward on successful hits
- Note trails, hit particles, and celebration effects on multiplier milestones
- Classic Guitar Hero lane colors: green, red, yellow, blue, orange
- Star power bar fills during sustained streaks (10+ notes)
- Stage effects: sweeping spotlights, wash lights, speaker stacks, lens flares, haze, and starfield
- Score resets automatically when a new song is identified

### Vynalize
- Animated logo with dual reactive eyes and head-bob motion
- Pupil dilation, lid openness, and brow bounce driven by beats
- Sparkle particles burst on beats, ripple rings expand outward
- Iris rotation and wave burst effects tied to audio energy

### Beat Saber
- 3D corridor with perspective projection and atmospheric fog
- 4-column, 3-row block grid with red/blue color-coded cubes
- Directional arrows (up/down/left/right) on block faces
- Frequency-band-driven block spawning with per-column gain compensation
- Neon arch frames and grid floor/ceiling for depth

## Beat Detection

- Real-time onset detection using spectral flux differential
- Cooldown-based beat gating (200ms minimum between beats)
- BPM estimation from median beat interval over rolling 30-beat window
- BPM display in the control overlay
- Beat events propagated to all visualizers via Zustand store

## Karaoke Lyrics

- Synced lyrics fetched from lrclib.net (LRC format with millisecond timestamps)
- Fallback to plain lyrics with estimated timing when synced lyrics unavailable
- Vertically scrolling display with auto-scroll to current line
- Active line highlighted with karaoke-style progressive fill animation
- Fill color uses accent color extracted from album art
- Past lines dim, upcoming lines shown at reduced opacity

## Position Tracking & Sync

- Elapsed time counter starts when song is identified
- Tap-to-sync: press when you hear the first lyric line to calibrate
- Fine-tune offset: +/- 0.2s and +/- 1s adjustment buttons
- Position displayed as MM:SS with current offset shown
- Position drives both lyrics scroll and video seek

## Music Video

- Automatic search for official music video via YouTube Data API
- YouTube IFrame embed, always muted (your record player provides the audio)
- Seeks to estimated position based on elapsed time and sync offset
- 7-day Redis-backed cache (falls back to in-memory LRU) to minimize YouTube API quota usage
- YouTube API quota tracking (48-hour rolling window) with automatic rejection above 9,000 calls
- Aspect-ratio-preserving display

## Visual Design

- Pure black background (#000) for OLED-friendly ambient display
- Album art blurred and dimmed as optional background layer behind visualizations
- Dominant color extraction from album art to tint all visualizations
- Controls auto-hide after 5 seconds of inactivity
- Gradient overlays on control bars for readability over any visualization
- Smooth crossfade transitions between display modes (500ms)

## UI & Controls

- Four app modes: Visualizer, Lyrics, Video, ASCII
- Twelve visualizer sub-modes selectable from bottom bar
- Fullscreen toggle via button or keyboard (F key)
- Keyboard shortcuts: 1/2/3/4 for mode switching, F for fullscreen, Esc to exit
- Visualizer favorites: star toggle on each visualizer mode, persisted across sessions
- Auto-cycle mode: automatically rotates through favorited (or all) visualizers at 15s/30s/60s intervals
- Visualizer descriptions: hover tooltip on each mode showing a short tag (e.g. "Retro grid", "Note highway")
- Settings panel with microphone input device selection and auto-cycle controls
- Server settings page at `/settings` for configuring YouTube API key and session code behavior
- Settings persist to `settings.json` and take effect immediately without a server restart
- Responsive layout for phone, tablet, desktop, and TV displays
- PWA with service worker (via vite-plugin-pwa): auto-updating, precached app shell, runtime-cached Google Fonts and API config
- Custom PWA install prompt: intercepts `beforeinstallprompt`, shows branded UI on both display and remote pages, dismissible with persisted state
- Share/screenshot: captures visualizer canvas with song info overlay and "Visualized with Vynalize" watermark; uses Web Share API on mobile, falls back to image download on desktop
- Song history: logs last 50 identified songs with timestamps, accessible from the controls overlay; deduplicates by title+artist; persisted to localStorage

## Phone Remote & Sessions

- Session-based WebSocket rooms — each display gets a unique 6-character code
- QR code pairing: session overlay shows a scannable QR code linking directly to `/remote?session=CODE`
- Phone remote at `/remote` prompts for session code entry (or accepts `?session=CODE` query param)
- Controllers only affect the display they're paired with — full multi-user isolation
- Remote shows session code in header, provides all controls: mode, visualizer, sensitivity
- Open mode (`REQUIRE_CODE=false`): disables session codes so remotes connect without a code
- WebSocket reconnection with exponential backoff (3s → 30s cap, max 10 retries), connection status tracked in store
- Redis pub/sub enables cross-instance message routing for multi-server deployments
- New controllers receive cached display state/song/beat on connect

## Song Play Tracking & Leaderboard

- Every successful Shazam match is recorded to a PostgreSQL database (fire-and-forget, never slows the identify response)
- Cache-based deduplication: same song from the same source within 5 minutes counts as one play (handles the 20-second re-identification cycle)
- Approximate geolocation (city, region, country) derived from IP via bundled MaxMind GeoLite2 database — IP is never stored
- Leaderboard API at `/api/leaderboard` with time period filtering (today, week, month, year, all time)
- Leaderboard UI at `/leaderboard` with period tabs, album art, play counts, and country flags
- Privacy policy at `/privacy` documenting all data practices
- Graceful degradation: play tracking silently disabled when `DATABASE_URL` is not set

## Technical

- Monorepo with npm workspaces (`packages/web` + `packages/server`)
- All 12 visualizers lazy-loaded with `React.lazy` to keep the main bundle small (~34KB gzipped)
- Leaderboard and Privacy pages also lazy-loaded
- React error boundary wraps the entire app with a reload prompt on uncaught errors
- Zustand persist middleware saves user preferences (appMode, visualizerMode, sensitivityGain, audioInputDeviceId, accentColor, songHistory, favorites, auto-cycle settings) to localStorage
- Offline detection via `useNetworkStatus` hook with banner in the UI when connectivity is lost
- API request timeouts with AbortController (15s identify, 8s lyrics/video) and automatic retry with 1s backoff
- Microphone permission denial detected with browser-specific guidance (iOS Safari, Chrome, Firefox) and retry button
- AudioContext lifecycle: closes old context before creating new on device change; visibility handler suspends/resumes on iOS background
- All API keys kept server-side, never exposed to the browser
- Security headers via helmet with Content Security Policy (YouTube, Google Fonts, lrclib.net, ws:/wss:, blob:, data:)
- CORS restricted to origin allowlist: localhost, 127.0.0.1, ::1, vynalize.local, and RFC 1918 private IPs
- Local-only middleware restricts `/api/settings` and `/api/diag` to loopback and private IPs
- `/api/log` endpoint secured with rate limiting (30/min), type validation, and log-injection prevention
- WebSocket message validation: 50KB size limit, type allowlist
- MusicBrainz rate limiting (1 req/1.1s) coordinated across instances via Redis
- Redis-backed caching for MusicBrainz and YouTube API results (7-day TTL)
- Per-IP rate limiting on all API endpoints (Redis sorted set sliding window, in-memory fallback with periodic cleanup and 10K key cap)
- Trust proxy configuration via `TRUST_PROXY` env var for correct client IP behind reverse proxies
- Multer audio upload validation: MIME type allowlist (webm, ogg, wav, mpeg, mp4), 3MB file size limit
- Worker thread pool for song identification — offloads ffmpeg+Shazam from the event loop
- Production clustering via Node.js `cluster` module (configurable via `WEB_CONCURRENCY`) with exponential respawn backoff (1s → 30s) and crash loop detection (5 crashes in 60s stops respawning)
- PostgreSQL for persistent song play tracking with auto-created schema on startup
- Graceful degradation: server runs without Redis in local dev — falls back to in-memory state for sessions, caching, and rate limiting
- Graceful degradation: server runs without PostgreSQL — play tracking silently disabled
- Graceful degradation: app works as a pure visualizer even without API keys

## Raspberry Pi Appliance Mode

- Runs as a headless, self-contained kiosk on Raspberry Pi 5 (or 4)
- Automated setup via `scripts/pi-setup.sh` (Node.js, Chromium, systemd, mDNS, ALSA)
- Audio capture auto-starts on boot via `?autostart` query parameter -- no click required
- Chromium kiosk flags auto-grant microphone access and allow AudioContext without user gesture
- USB mic auto-detected and configured as default ALSA capture device
- mDNS hostname `vynalize.local` -- phone remote works at `vynalize.local:3001/remote`

## 3D-Printable Enclosure

- Parametric OpenSCAD design in `hardware/puck/` for a two-piece (base + lid) appliance case
- Houses Pi 5 and Adafruit Mini USB Mic (#3367) fully enclosed
- Mic grille in right wall for ambient audio pickup
- Exposed ports: USB-C power, 2× micro-HDMI, Ethernet, SD card
- ~105 × 62 × 30 mm, prints without supports in PLA or PETG

## Planned

- RapidAPI Shazam (apidojo) integration for higher accuracy and richer metadata
- Seasonal visualizer screens (e.g. snowfall for winter, cherry blossoms for spring, fireflies for summer, falling leaves for autumn)
