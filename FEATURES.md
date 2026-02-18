# Features

## Audio Capture & Analysis

- Microphone-based audio capture via Web Audio API (`getUserMedia`)
- Raw audio mode: echo cancellation, noise suppression, and auto gain all disabled for faithful signal
- Real-time FFT frequency analysis (2048-point) at 60fps
- Extracted features: RMS, energy, spectral centroid, spectral flux, zero crossing rate, bass/mid/high band energies

## Song Identification

- Shazam-powered recognition via node-shazam -- designed for ambient/room audio
- Automatic identification from microphone capture every 30 seconds
- Returns title, artist, album, and album art directly from Shazam
- No API key required for song identification
- Manual search fallback via MusicBrainz (type artist + title directly)
- Album artwork from Shazam or Cover Art Archive (manual search)
- Periodic re-identification to detect track changes
- Animated listening indicator that pulses with audio energy
- Future: RapidAPI Shazam (apidojo) integration for higher accuracy and richer metadata

## Visualizer Modes

Ten built-in visualizations, all reactive to live audio:

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
- ECG, plethysmography, and EEG (delta/alpha/beta) channels
- Digital biometric readouts (HR, SpO2, BP, respiration) modulated by audio

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
- Daily YouTube API quota tracking with automatic rejection above 9,000 calls/day
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
- Ten visualizer sub-modes selectable from bottom bar
- Fullscreen toggle via button or keyboard (F key)
- Keyboard shortcuts: 1/2/3/4 for mode switching, F for fullscreen, Esc to exit
- Settings panel with microphone input device selection
- Responsive layout for phone, tablet, desktop, and TV displays
- PWA manifest for "install to home screen" on mobile

## Phone Remote & Sessions

- Session-based WebSocket rooms — each display gets a unique 6-character code
- Phone remote at `/remote` prompts for session code entry (or accepts `?session=CODE` query param)
- Controllers only affect the display they're paired with — full multi-user isolation
- Remote shows session code in header, provides all controls: mode, visualizer, sensitivity
- Redis pub/sub enables cross-instance message routing for multi-server deployments
- New controllers receive cached display state/song/beat on connect

## Technical

- Monorepo with npm workspaces (`packages/web` + `packages/server`)
- 3D visualizer (Particle Field) lazy-loaded to avoid loading Three.js until needed
- Main app bundle only ~33KB gzipped
- All API keys kept server-side, never exposed to the browser
- MusicBrainz rate limiting (1 req/1.1s) coordinated across instances via Redis
- Redis-backed caching for MusicBrainz and YouTube API results (7-day TTL)
- Per-IP rate limiting on all API endpoints (Redis sorted set sliding window, in-memory fallback)
- Worker thread pool for song identification — offloads ffmpeg+Shazam from the event loop
- Production clustering via Node.js `cluster` module (configurable via `WEB_CONCURRENCY`)
- Graceful degradation: server runs without Redis in local dev — falls back to in-memory state for sessions, caching, and rate limiting
- Graceful degradation: app works as a pure visualizer even without API keys

## Raspberry Pi Appliance Mode

- Runs as a headless, self-contained kiosk on Raspberry Pi 5 (or 4)
- Automated setup via `scripts/pi-setup.sh` (Node.js, Chromium, systemd, mDNS, ALSA)
- Audio capture auto-starts on boot via `?autostart` query parameter -- no click required
- Chromium kiosk flags auto-grant microphone access and allow AudioContext without user gesture
- USB mic auto-detected and configured as default ALSA capture device
- mDNS hostname `vynalize.local` -- phone remote works at `vynalize.local:3001/remote`

## Planned

- Seasonal visualizer screens (e.g. snowfall for winter, cherry blossoms for spring, fireflies for summer, falling leaves for autumn)
