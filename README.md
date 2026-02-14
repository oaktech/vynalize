# Vinyl Visions

A companion display for analog listening. Vinyl Visions passively listens to music from your record player (or any speaker) via the device microphone, identifies what's playing, and provides synchronized visual experiences: audio-reactive visualizations, karaoke-style lyrics, and music videos.

The app never plays music itself -- it's a visual companion for your analog setup.

## Quick Start

### Prerequisites

- Node.js 18+
- [ffmpeg](https://ffmpeg.org/) for audio format conversion:
  ```bash
  # macOS
  brew install ffmpeg

  # Ubuntu/Debian
  sudo apt install ffmpeg

  # Windows (via Chocolatey)
  choco install ffmpeg
  ```

### API Keys (Free)

| Service | Purpose | Get one at |
|---|---|---|
| YouTube Data API v3 | Music video search | https://console.cloud.google.com |

Song identification uses Shazam and requires no API key. The app works as a pure visualizer even without any API keys configured.

### Setup

```bash
git clone https://github.com/oaktech/vinyl-visions.git
cd vinyl-visions

# Install dependencies
npm install

# Configure API keys
cp .env.example .env
# Edit .env and add your YouTube API key

# Start development servers (frontend + backend)
npm run dev
```

- Frontend: http://localhost:5173
- Backend: http://localhost:3001

## How It Works

1. **Listen** -- Grant microphone access and play music from a nearby speaker
2. **Identify** -- The app captures audio snippets and identifies them using Shazam's audio fingerprinting
3. **Visualize** -- Choose from 10 visualization modes, synced karaoke lyrics, ASCII art, or a muted music video
4. **Sync** -- Use tap-to-sync and offset controls to align lyrics and video with your playback

## Display Modes

| Mode | Description |
|---|---|
| Visualizer | 10 audio-reactive visualizations (see below) |
| Lyrics | Karaoke-style synced lyrics from lrclib.net |
| Video | Muted YouTube music video, synced to your playback |
| ASCII | Song title and lyrics rendered as ASCII art |

Switch modes with keyboard shortcuts, the mode selector, or a hands-free double-clap.

## Visualizers

| # | Name | Description |
|---|---|---|
| 1 | Spectrum Bars | 64-bar frequency spectrum with reflections and beat flash |
| 2 | Waveform | Oscilloscope-style time-domain display with glow |
| 3 | Radial Spectrum | 128-bar circular display with BPM-driven rotation |
| 4 | Particle Field | 2,000 particles in 3D, driven by bass/mid/high bands |
| 5 | Geometric Shapes | Wireframe polyhedra responding to frequency bands |
| 6 | Radical | -- |
| 7 | Nebula | -- |
| 8 | Vitals | ECG-style visualizer |
| 9 | Synthwave | Retro 80s aesthetic |
| 10 | Space Age | -- |

3D visualizers (Particle Field, Geometric Shapes) are lazy-loaded to keep the main bundle small (~33KB gzipped).

## Beat Detection

Real-time onset detection using spectral flux with BPM estimation from a rolling 30-beat window. Beat events drive visual effects across all visualizers. BPM is displayed in the control overlay.

## Double-Clap Mode Switching

Hands-free mode cycling for TV/cast setups. Two claps within 300--800ms cycles through Visualizer, Lyrics, Video, and ASCII modes. A 3-second cooldown prevents rapid cycling, and a visual flash confirms detection.

## Architecture

```
vinyl-visions/
├── packages/
│   ├── web/          # React + TypeScript + Vite frontend
│   └── server/       # Express + TypeScript backend
└── package.json      # npm workspaces root
```

**Why a backend?** Song identification via Shazam requires server-side audio processing, and the YouTube Data API key is kept out of the browser.

### External Services

| Service | Purpose | Auth |
|---|---|---|
| Shazam (via node-shazam) | Song identification | None |
| MusicBrainz | Manual search metadata | None (User-Agent only) |
| Cover Art Archive | Album artwork (manual search) | None |
| lrclib.net | Synced lyrics (LRC) | None |
| YouTube Data API | Video search | API key (server-side) |
| YouTube IFrame API | Video embed | None |

## Scripts

```bash
npm run dev          # Start both frontend and backend
npm run dev:web      # Frontend only
npm run dev:server   # Backend only
npm run build        # Production build
```

## Keyboard Shortcuts

| Key | Action |
|---|---|
| `F` | Toggle fullscreen |
| `Esc` | Exit fullscreen |
| `1` | Visualizer mode |
| `2` | Lyrics mode |
| `3` | Video mode |
| `4` | ASCII mode |

## Tech Stack

- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, Zustand, Three.js / React Three Fiber
- **Backend:** Express, TypeScript, node-shazam
- **Audio:** Web Audio API, AnalyserNode for real-time FFT (2048-point at 60fps)

Installable as a PWA on mobile via the browser's "Add to Home Screen" option.

## License

MIT
