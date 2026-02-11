# Features

## Audio Capture & Analysis

- Microphone-based audio capture via Web Audio API (`getUserMedia`)
- Raw audio mode: echo cancellation, noise suppression, and auto gain all disabled for faithful signal
- Real-time FFT frequency analysis (2048-point) at 60fps
- Extracted features: RMS, energy, spectral centroid, spectral flux, zero crossing rate, bass/mid/high band energies

## Song Identification

- Audio fingerprinting via Chromaprint (`fpcalc`)
- Automatic identification through AcoustID database
- Metadata enrichment from MusicBrainz (title, artist, album, duration)
- Album artwork from Cover Art Archive
- Periodic re-identification every 20 seconds to detect track changes
- Animated listening indicator that pulses with audio energy

## Visualizer Modes

Five built-in visualizations, all reactive to live audio:

### Spectrum Bars
- 64-bar frequency spectrum with rounded tops
- Accent color gradients with beat-triggered flash
- Subtle reflection effect below the bars

### Waveform
- Oscilloscope-style time-domain display
- Glow effect intensifies on beat events
- Mirrored secondary trace for depth

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

### Geometric Shapes (3D)
- Three wireframe polyhedra: icosahedron, octahedron, dodecahedron
- Each shape responds to a different frequency band (bass, mid, high)
- Scale, rotation speed, and emissive glow modulated by audio energy
- Beat-triggered scaling pulse

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
- 24-hour server-side cache to minimize YouTube API quota usage
- Aspect-ratio-preserving display

## Visual Design

- Pure black background (#000) for OLED-friendly ambient display
- Album art blurred and dimmed as optional background layer behind visualizations
- Dominant color extraction from album art to tint all visualizations
- Controls auto-hide after 5 seconds of inactivity
- Gradient overlays on control bars for readability over any visualization
- Smooth crossfade transitions between display modes (500ms)

## UI & Controls

- Three app modes: Visualizer, Lyrics, Video
- Five visualizer sub-modes selectable from bottom bar
- Fullscreen toggle via button or keyboard (F key)
- Keyboard shortcuts: 1/2/3 for mode switching, F for fullscreen, Esc to exit
- Settings panel with microphone input device selection
- Responsive layout for phone, tablet, desktop, and TV displays
- PWA manifest for "install to home screen" on mobile

## Technical

- Monorepo with npm workspaces (`packages/web` + `packages/server`)
- 3D visualizers lazy-loaded to avoid loading Three.js (~970KB) until needed
- Main app bundle only ~33KB gzipped
- All API keys kept server-side, never exposed to the browser
- MusicBrainz rate limiting (1 req/sec) built into the server
- Graceful degradation: app works as a pure visualizer even without API keys
