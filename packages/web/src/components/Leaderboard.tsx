import { useState, useEffect } from 'react';

const PERIODS = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'This Week' },
  { key: 'month', label: 'This Month' },
  { key: 'year', label: 'This Year' },
  { key: 'all', label: 'All Time' },
] as const;

interface Song {
  rank: number;
  title: string;
  artist: string;
  album: string | null;
  albumArtUrl: string | null;
  playCount: number;
  topCity: string | null;
  topCountry: string | null;
}

function countryFlag(code: string | null): string {
  if (!code || code.length !== 2) return '';
  return String.fromCodePoint(
    ...code.toUpperCase().split('').map((c) => 0x1f1e6 + c.charCodeAt(0) - 65),
  );
}

export default function Leaderboard() {
  const [period, setPeriod] = useState('week');
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/leaderboard?period=${period}&limit=50`)
      .then((r) => r.json())
      .then((data) => setSongs(data.songs ?? []))
      .catch(() => setSongs([]))
      .finally(() => setLoading(false));
  }, [period]);

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <a href="/" className="text-white/30 text-sm hover:text-white/60 transition-colors">
              &larr; Back
            </a>
            <h1 className="text-2xl font-bold mt-1">Leaderboard</h1>
            <p className="text-white/40 text-sm mt-1">Most played songs across all sessions</p>
          </div>
        </div>

        {/* Period tabs */}
        <div className="flex gap-1 mb-6 overflow-x-auto pb-1">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={`px-4 py-2 rounded-xl text-sm whitespace-nowrap transition-all duration-200 ${
                period === p.key
                  ? 'bg-white/15 text-white'
                  : 'bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/60'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-5 h-5 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
          </div>
        ) : songs.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-white/30 text-lg">No plays yet</p>
            <p className="text-white/20 text-sm mt-2">Songs will appear here as people listen</p>
          </div>
        ) : (
          <div className="space-y-2">
            {songs.map((song) => (
              <div
                key={`${song.title}-${song.artist}`}
                className="flex items-center gap-4 p-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] transition-colors"
              >
                {/* Rank */}
                <span className="w-8 text-center text-sm font-mono text-white/30 shrink-0">
                  {song.rank}
                </span>

                {/* Album art */}
                {song.albumArtUrl ? (
                  <img
                    src={song.albumArtUrl}
                    alt=""
                    className="w-10 h-10 rounded-lg object-cover shrink-0"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-white/10 shrink-0" />
                )}

                {/* Song info */}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{song.title}</p>
                  <p className="text-xs text-white/40 truncate">{song.artist}</p>
                </div>

                {/* Location */}
                {song.topCountry && (
                  <span className="text-xs text-white/30 shrink-0 hidden sm:block">
                    {countryFlag(song.topCountry)}
                    {song.topCity ? ` ${song.topCity}` : ''}
                  </span>
                )}

                {/* Play count */}
                <span className="text-sm font-mono text-white/50 shrink-0">
                  {song.playCount}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="mt-12 text-center">
          <a href="/privacy" className="text-white/20 text-xs hover:text-white/40 transition-colors">
            Privacy Policy
          </a>
        </div>
      </div>
    </div>
  );
}
