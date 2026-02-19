import { useState } from 'react';
import { useStore } from '../store';
import type { SongInfo } from '../types';

export default function ManualSearch() {
  const [isOpen, setIsOpen] = useState(false);
  const [artist, setArtist] = useState('');
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const setCurrentSong = useStore((s) => s.setCurrentSong);
  const currentSong = useStore((s) => s.currentSong);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!artist.trim() || !title.trim()) return;

    setLoading(true);

    try {
      // Search MusicBrainz via backend for metadata + album art
      const params = new URLSearchParams({
        artist: artist.trim(),
        title: title.trim(),
      });
      const res = await fetch(`/api/search?${params}`);
      const data = await res.json();

      const song: SongInfo = {
        title: data.title || title.trim(),
        artist: data.artist || artist.trim(),
        album: data.album || '',
        duration: data.duration || 0,
        albumArtUrl: data.albumArtUrl || null,
        musicbrainzId: data.musicbrainzId || null,
        bpm: null,
      };

      setCurrentSong(song);
    } catch {
      // Fallback: set with just the typed info
      setCurrentSong({
        title: title.trim(),
        artist: artist.trim(),
        album: '',
        duration: 0,
        albumArtUrl: null,
        musicbrainzId: null,
        bpm: null,
      });
    }

    setLoading(false);
    setIsOpen(false);
    setArtist('');
    setTitle('');
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="px-3 py-1.5 text-xs text-white/40 hover:text-white/70 bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
        aria-label="Manually enter song info"
        title="Manually enter song info"
      >
        {currentSong ? 'Wrong song?' : 'Enter song'}
      </button>
    );
  }

  return (
    <div className="relative">
      <form onSubmit={handleSubmit} className="absolute right-0 top-full mt-2 sm:static sm:mt-0 flex flex-col sm:flex-row items-stretch sm:items-center gap-2 bg-black/90 sm:bg-transparent backdrop-blur-sm sm:backdrop-blur-none rounded-lg sm:rounded-none p-3 sm:p-0 border border-white/10 sm:border-0 min-w-[240px] sm:min-w-0">
        <input
          type="text"
          placeholder="Artist"
          aria-label="Artist name"
          value={artist}
          onChange={(e) => setArtist(e.target.value)}
          className="w-full sm:w-28 px-3 py-2 sm:px-2 sm:py-1 text-xs bg-black border border-white/15 rounded-md text-white placeholder-white/25 focus:outline-none focus:border-white/40"
          autoFocus
        />
        <input
          type="text"
          placeholder="Song title"
          aria-label="Song title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full sm:w-36 px-3 py-2 sm:px-2 sm:py-1 text-xs bg-black border border-white/15 rounded-md text-white placeholder-white/25 focus:outline-none focus:border-white/40"
        />
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={loading}
            className="flex-1 sm:flex-initial px-3 py-2 sm:px-2 sm:py-1 text-xs font-medium text-white/70 bg-white/10 hover:bg-white/15 rounded-md transition-colors disabled:opacity-40"
          >
            {loading ? '...' : 'Set'}
          </button>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="flex-1 sm:flex-initial px-3 py-2 sm:px-1.5 sm:py-1 text-xs text-white/30 hover:text-white/60 transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
