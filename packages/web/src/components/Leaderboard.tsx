import { useState, useEffect, useRef, useCallback } from 'react';

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
  lastPlayed: string | null;
}

interface Artist {
  rank: number;
  artist: string;
  playCount: number;
  songCount: number;
  albumArtUrl: string | null;
  topCountry: string | null;
  lastPlayed: string | null;
}

interface Genre {
  rank: number;
  genre: string;
  playCount: number;
  artistCount: number;
  topCountry: string | null;
  lastPlayed: string | null;
}

interface Summary {
  totalPlays: number;
  uniqueCount: number;
}

function countryFlag(code: string | null): string {
  if (!code || code.length !== 2) return '';
  return String.fromCodePoint(
    ...code.toUpperCase().split('').map((c) => 0x1f1e6 + c.charCodeAt(0) - 65),
  );
}

function timeAgo(iso: string | null): string {
  if (!iso) return '';
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

function pluralize(count: number, singular: string, plural?: string): string {
  return count === 1 ? singular : (plural ?? singular + 's');
}

const PAGE_SIZE = 20;

export default function Leaderboard() {
  const [period, setPeriod] = useState('week');
  const [category, setCategory] = useState('songs');
  const [songs, setSongs] = useState<Song[]>([]);
  const [artists, setArtists] = useState<Artist[]>([]);
  const [genres, setGenres] = useState<Genre[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Reset and fetch first page when filters change
  useEffect(() => {
    setLoading(true);
    setHasMore(true);
    fetch(`/api/leaderboard?period=${period}&category=${category}&limit=${PAGE_SIZE}&offset=0`)
      .then((r) => r.json())
      .then((data) => {
        const items = data.songs ?? data.artists ?? data.genres ?? [];
        setSongs(data.songs ?? []);
        setArtists(data.artists ?? []);
        setGenres(data.genres ?? []);
        setSummary(data.summary ?? null);
        if (items.length < PAGE_SIZE) setHasMore(false);
      })
      .catch(() => {
        setSongs([]);
        setArtists([]);
        setGenres([]);
        setSummary(null);
        setHasMore(false);
      })
      .finally(() => setLoading(false));
  }, [period, category]);

  const currentLength =
    category === 'songs' ? songs.length : category === 'artists' ? artists.length : genres.length;

  const loadMore = useCallback(() => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    fetch(`/api/leaderboard?period=${period}&category=${category}&limit=${PAGE_SIZE}&offset=${currentLength}`)
      .then((r) => r.json())
      .then((data) => {
        const items = data.songs ?? data.artists ?? data.genres ?? [];
        if (items.length < PAGE_SIZE) setHasMore(false);
        if (data.songs) setSongs((prev) => [...prev, ...data.songs]);
        if (data.artists) setArtists((prev) => [...prev, ...data.artists]);
        if (data.genres) setGenres((prev) => [...prev, ...data.genres]);
      })
      .catch(() => setHasMore(false))
      .finally(() => setLoadingMore(false));
  }, [period, category, currentLength, loadingMore, hasMore]);

  // IntersectionObserver on sentinel triggers next page
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) loadMore(); },
      { rootMargin: '200px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [loadMore]);

  const isEmpty =
    (category === 'songs' && songs.length === 0) ||
    (category === 'artists' && artists.length === 0) ||
    (category === 'genres' && genres.length === 0);

  const rankClass = (rank: number) =>
    rank <= 3
      ? 'w-7 h-7 rounded-full bg-white/15 text-white font-bold text-xs flex items-center justify-center shrink-0'
      : 'w-7 text-center text-sm font-mono text-white/30 shrink-0';

  const summaryLabel =
    category === 'songs' ? 'song' : category === 'artists' ? 'artist' : 'genre';

  return (
    <div className="fixed inset-0 overflow-y-auto bg-black text-white">
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
        <div className="sticky top-0 z-10 bg-black pb-3 pt-2 -mx-4 px-4 border-b border-white/[0.06]">
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
            {/* Summary stats */}
            {summary && (
              <div className="flex items-center gap-3 px-3 py-2 text-xs text-white/30">
                <span>{summary.totalPlays.toLocaleString()} {pluralize(summary.totalPlays, 'play')}</span>
                <span className="text-white/10">|</span>
                <span>{summary.uniqueCount.toLocaleString()} {pluralize(summary.uniqueCount, summaryLabel)}</span>
              </div>
            )}

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
                    <div className="w-10 h-10 rounded-lg bg-white/10 shrink-0 flex items-center justify-center text-white/30 text-sm">{'\u{1F3B5}'}</div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{song.title}</p>
                    <p className="text-xs text-white/40 truncate">
                      {song.artist}
                      {song.album && <span className="text-white/20"> &middot; {song.album}</span>}
                    </p>
                  </div>
                  {song.topCountry && (
                    <span className="text-base shrink-0" title="Top listener location">
                      {countryFlag(song.topCountry)}
                    </span>
                  )}
                  <div className="flex flex-col items-end gap-0.5 shrink-0">
                    <span className="text-xs font-mono text-white/50">
                      {song.playCount} <span className="text-white/30">{pluralize(song.playCount, 'play')}</span>
                    </span>
                    {song.lastPlayed && (
                      <span className="text-[10px] text-white/20">{timeAgo(song.lastPlayed)}</span>
                    )}
                  </div>
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
                    <div className="w-10 h-10 rounded-full bg-white/10 shrink-0 flex items-center justify-center text-white/30 text-sm">{'\u{1F3A4}'}</div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{artist.artist}</p>
                    <p className="text-xs text-white/40">
                      {artist.songCount} {pluralize(artist.songCount, 'song')}
                    </p>
                  </div>
                  {artist.topCountry && (
                    <span className="text-base shrink-0" title="Top listener location">
                      {countryFlag(artist.topCountry)}
                    </span>
                  )}
                  <div className="flex flex-col items-end gap-0.5 shrink-0">
                    <span className="text-xs font-mono text-white/50">
                      {artist.playCount} <span className="text-white/30">{pluralize(artist.playCount, 'play')}</span>
                    </span>
                    {artist.lastPlayed && (
                      <span className="text-[10px] text-white/20">{timeAgo(artist.lastPlayed)}</span>
                    )}
                  </div>
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
                      {genre.artistCount} {pluralize(genre.artistCount, 'artist')}
                    </p>
                  </div>
                  {genre.topCountry && (
                    <span className="text-base shrink-0" title="Top listener location">
                      {countryFlag(genre.topCountry)}
                    </span>
                  )}
                  <div className="flex flex-col items-end gap-0.5 shrink-0">
                    <span className="text-xs font-mono text-white/50">
                      {genre.playCount} <span className="text-white/30">{pluralize(genre.playCount, 'play')}</span>
                    </span>
                    {genre.lastPlayed && (
                      <span className="text-[10px] text-white/20">{timeAgo(genre.lastPlayed)}</span>
                    )}
                  </div>
                </div>
              ))}
          {/* Sentinel for infinite scroll */}
          {hasMore && <div ref={sentinelRef} className="h-1" />}
          {loadingMore && (
            <div className="flex justify-center py-4">
              <div className="w-4 h-4 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
            </div>
          )}
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
