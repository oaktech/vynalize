# Vinyl Visions

A companion display for analog listening. Vinyl Visions passively listens to music from your record player (or any speaker) via the device microphone, identifies what's playing, and provides synchronized visual experiences: audio-reactive visualizations, karaoke-style lyrics, and music videos.

The app never plays music itself -- it's a visual companion for your analog setup.

## Quick Start

### Prerequisites

- Node.js 18+

### API Keys (Free)

| Service | Purpose | Get one at |
|---|---|---|
| ACRCloud | Song identification from ambient audio | https://console.acrcloud.com |
| YouTube Data API v3 | Music video search | https://console.cloud.google.com |

### Setup

```bash
git clone https://github.com/oaktech/vinyl-visions.git
cd vinyl-visions

# Install dependencies
npm install

# Configure API keys
cp .env.example .env
# Edit .env and add your ACRCloud + YouTube keys

# Start development servers (frontend + backend)
npm run dev
```

- Frontend: http://localhost:5173
- Backend: http://localhost:3001

## How It Works

1. **Listen** -- Grant microphone access and play music from a nearby speaker
2. **Identify** -- The app captures audio snippets and sends them to ACRCloud for recognition
3. **Visualize** -- Choose from 5 visualization modes, synced karaoke lyrics, or a muted music video
4. **Sync** -- Use tap-to-sync and offset controls to align lyrics and video with your playback

You can also manually enter the artist and song title if automatic identification doesn't pick it up.

## Architecture

```
vinyl-visions/
├── packages/
│   ├── web/          # React + TypeScript + Vite frontend
│   └── server/       # Express + TypeScript backend
└── package.json      # npm workspaces root
```

**Why a backend?** ACRCloud requires HMAC-SHA1 signed requests with a secret key. The server handles authentication, proxies API calls, and keeps credentials out of the browser.

### External Services

| Service | Purpose | Auth |
|---|---|---|
| ACRCloud | Song identification from audio | API key + secret (server-side) |
| MusicBrainz | Song metadata + manual search | None (User-Agent only) |
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
- **Backend:** Express, TypeScript
- **Audio:** Web Audio API, AnalyserNode for real-time FFT
- **Identification:** ACRCloud (designed for ambient audio recognition)

## License

MIT
