import { useState, useEffect } from 'react';

const PERIODS = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'This Week' },
  { key: 'month', label: 'This Month' },
  { key: 'year', label: 'This Year' },
  { key: 'all', label: 'All Time' },
] as const;

const CATEGORIES = [
  { key: 'songs', label: 'Songs' },
  { key: 'artists', label: 'Artists' },
  { key: 'genres', label: 'Genres' },
] as const;

interface Song {
  rank: number;
  title: string;
  artist: string;
  album: string | null;
  albumArtUrl: string | null;
  playCount: number;
  topCountry: string | null;
}

interface Artist {
  rank: number;
  artist: string;
  playCount: number;
  songCount: number;
  albumArtUrl: string | null;
  topCountry: string | null;
}

interface Genre {
  rank: number;
  genre: string;
  playCount: number;
  artistCount: number;
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
  const [category, setCategory] = useState('songs');
  const [songs, setSongs] = useState<Song[]>([]);
  const [artists, setArtists] = useState<Artist[]>([]);
  const [genres, setGenres] = useState<Genre[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/leaderboard?period=${period}&category=${category}&limit=20`)
      .then((r) => r.json())
      .then((data) => {
        setSongs(data.songs ?? []);
        setArtists(data.artists ?? []);
        setGenres(data.genres ?? []);
      })
      .catch(() => {
        setSongs([]);
        setArtists([]);
        setGenres([]);
      })
      .finally(() => setLoading(false));
  }, [period, category]);

  const isEmpty =
    (category === 'songs' && songs.length === 0) ||
    (category === 'artists' && artists.length === 0) ||
    (category === 'genres' && genres.length === 0);

  const rankClass = (rank: number) =>
    rank <= 3
      ? 'w-7 h-7 rounded-full bg-white/15 text-white font-bold text-xs flex items-center justify-center shrink-0'
      : 'w-7 text-center text-sm font-mono text-white/30 shrink-0';

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-2xl mx-auto px-4 pt-6 pb-8">
        {/* Header */}
        <div className="mb-4">
          <a href="/" className="text-white/30 text-sm hover:text-white/60 transition-colors">
            &larr; Back
          </a>
          <h1 className="text-2xl font-bold mt-1">Leaderboard</h1>
          <p className="text-white/40 text-sm mt-1">Most played across all sessions</p>
        </div>

        {/* Sticky navigation */}
        <div className="sticky top-0 z-10 bg-black pb-3 pt-2 -mx-4 px-4">
          {/* Category tabs */}
          <div className="flex gap-1 mb-2">
            {CATEGORIES.map((c) => (
              <button
                key={c.key}
                onClick={() => setCategory(c.key)}
                className={`px-4 py-1.5 rounded-xl text-sm transition-all duration-200 ${
                  category === c.key
                    ? 'bg-white text-black font-medium'
                    : 'bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/60'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>

          {/* Period tabs */}
          <div className="flex gap-1 overflow-x-auto">
            {PERIODS.map((p) => (
              <button
                key={p.key}
                onClick={() => setPeriod(p.key)}
                className={`px-3 py-1.5 rounded-xl text-xs whitespace-nowrap transition-all duration-200 ${
                  period === p.key
                    ? 'bg-white/15 text-white'
                    : 'bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/60'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-5 h-5 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
          </div>
        ) : isEmpty ? (
          <div className="text-center py-20">
            <p className="text-white/30 text-lg">No plays yet</p>
            <p className="text-white/20 text-sm mt-2">
              {category === 'genres'
                ? 'Genres will appear here as songs are identified'
                : `${category === 'artists' ? 'Artists' : 'Songs'} will appear here as people listen`}
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {category === 'songs' &&
              songs.map((song) => (
                <div
                  key={`${song.title}-${song.artist}`}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${
                    song.rank <= 3
                      ? 'bg-white/[0.05] hover:bg-white/[0.08]'
                      : 'bg-white/[0.02] hover:bg-white/[0.05]'
                  }`}
                >
                  <span className={rankClass(song.rank)}>{song.rank}</span>
                  {song.albumArtUrl ? (
                    <img src={song.albumArtUrl} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0" />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-white/10 shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{song.title}</p>
                    <p className="text-xs text-white/40 truncate">{song.artist}</p>
                  </div>
                  {song.topCountry && (
                    <span className="text-xs shrink-0 hidden sm:block">
                      {countryFlag(song.topCountry)}
                    </span>
                  )}
                  <span className="text-xs font-mono text-white/50 shrink-0">
                    {song.playCount} <span className="text-white/30">plays</span>
                  </span>
                </div>
              ))}

            {category === 'artists' &&
              artists.map((artist) => (
                <div
                  key={artist.artist}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${
                    artist.rank <= 3
                      ? 'bg-white/[0.05] hover:bg-white/[0.08]'
                      : 'bg-white/[0.02] hover:bg-white/[0.05]'
                  }`}
                >
                  <span className={rankClass(artist.rank)}>{artist.rank}</span>
                  {artist.albumArtUrl ? (
                    <img src={artist.albumArtUrl} alt="" className="w-10 h-10 rounded-full object-cover shrink-0" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-white/10 shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{artist.artist}</p>
                    <p className="text-xs text-white/40">
                      {artist.songCount} {artist.songCount === 1 ? 'song' : 'songs'}
                    </p>
                  </div>
                  {artist.topCountry && (
                    <span className="text-xs shrink-0 hidden sm:block">
                      {countryFlag(artist.topCountry)}
                    </span>
                  )}
                  <span className="text-xs font-mono text-white/50 shrink-0">
                    {artist.playCount} <span className="text-white/30">plays</span>
                  </span>
                </div>
              ))}

            {category === 'genres' &&
              genres.map((genre) => (
                <div
                  key={genre.genre}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${
                    genre.rank <= 3
                      ? 'bg-white/[0.05] hover:bg-white/[0.08]'
                      : 'bg-white/[0.02] hover:bg-white/[0.05]'
                  }`}
                >
                  <span className={rankClass(genre.rank)}>{genre.rank}</span>
                  <div className="w-10 h-10 rounded-xl bg-white/10 shrink-0 flex items-center justify-center text-lg">
                    {genre.rank <= 3 ? ['\u{1F947}', '\u{1F948}', '\u{1F949}'][genre.rank - 1] : '\u{1F3B5}'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{genre.genre}</p>
                    <p className="text-xs text-white/40">
                      {genre.artistCount} {genre.artistCount === 1 ? 'artist' : 'artists'}
                    </p>
                  </div>
                  {genre.topCountry && (
                    <span className="text-xs shrink-0 hidden sm:block">
                      {countryFlag(genre.topCountry)}
                    </span>
                  )}
                  <span className="text-xs font-mono text-white/50 shrink-0">
                    {genre.playCount} <span className="text-white/30">plays</span>
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
