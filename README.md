# Vinyl Visions

A companion display for analog listening. Vinyl Visions passively listens to music from your record player (or any speaker) via the device microphone, identifies what's playing, and provides synchronized visual experiences: audio-reactive visualizations, karaoke-style lyrics, and music videos.

The app never plays music itself -- it's a visual companion for your analog setup.

## Quick Start

### Prerequisites

- Node.js 18+
- [Chromaprint](https://acoustid.org/chromaprint) (`fpcalc` CLI) for song fingerprinting:
  ```bash
  # macOS
  brew install chromaprint

  # Ubuntu/Debian
  sudo apt install libchromaprint-tools

  # Windows (via Chocolatey)
  choco install chromaprint
  ```

### API Keys (Free)

| Service | Purpose | Get one at |
|---|---|---|
| AcoustID | Song identification | https://acoustid.org/new-application |
| YouTube Data API v3 | Music video search | https://console.cloud.google.com |

### Setup

```bash
git clone https://github.com/oaktech/vinyl-visions.git
cd vinyl-visions

# Install dependencies
npm install

# Configure API keys
cp .env.example .env
# Edit .env and add your keys

# Start development servers (frontend + backend)
npm run dev
```

- Frontend: http://localhost:5173
- Backend: http://localhost:3001

## How It Works

1. **Listen** -- Grant microphone access and play music from a nearby speaker
2. **Identify** -- The app captures audio snippets, fingerprints them with Chromaprint, and looks them up on AcoustID
3. **Visualize** -- Choose from 5 visualization modes, synced karaoke lyrics, or a muted music video
4. **Sync** -- Use tap-to-sync and offset controls to align lyrics and video with your playback

## Architecture

```
vinyl-visions/
├── packages/
│   ├── web/          # React + TypeScript + Vite frontend
│   └── server/       # Express + TypeScript backend
└── package.json      # npm workspaces root
```

**Why a backend?** Chromaprint has no reliable browser build and AcoustID lacks CORS headers. The server runs `fpcalc` for fingerprinting, proxies AcoustID lookups, and keeps API keys out of the browser.

### External Services

| Service | Purpose | Auth |
|---|---|---|
| AcoustID | Audio fingerprint lookup | API key (server-side) |
| MusicBrainz | Song metadata | None (User-Agent only) |
| Cover Art Archive | Album artwork | None |
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

## Tech Stack

- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, Zustand, Three.js / React Three Fiber
- **Backend:** Express, TypeScript, Chromaprint/fpcalc
- **Audio:** Web Audio API, AnalyserNode for real-time FFT

## License

MIT
