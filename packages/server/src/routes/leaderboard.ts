import { Router } from 'express';
import { dbAvailable, getPool } from '../services/db.js';

export const leaderboardRouter = Router();

const PERIOD_FILTERS: Record<string, string> = {
  today: `played_at >= NOW() - INTERVAL '24 hours'`,
  week: `played_at >= NOW() - INTERVAL '7 days'`,
  month: `played_at >= DATE_TRUNC('month', NOW() AT TIME ZONE 'UTC')`,
  year: `played_at >= DATE_TRUNC('year', NOW() AT TIME ZONE 'UTC')`,
  all: '1=1',
};

const CATEGORIES = new Set(['songs', 'artists', 'genres']);

leaderboardRouter.get('/', async (req, res) => {
  const category = String(req.query.category || 'songs');

  if (!dbAvailable) {
    res.json({ period: req.query.period || 'all', [category]: [] });
    return;
  }

  const period = String(req.query.period || 'all');
  const limit = Math.min(Math.max(parseInt(String(req.query.limit || '25'), 10) || 25, 1), 100);
  const offset = Math.max(parseInt(String(req.query.offset || '0'), 10) || 0, 0);

  const whereClause = PERIOD_FILTERS[period];
  if (!whereClause) {
    res.status(400).json({ error: 'Invalid period. Use: today, week, month, year, all' });
    return;
  }

  if (!CATEGORIES.has(category)) {
    res.status(400).json({ error: 'Invalid category. Use: songs, artists, genres' });
    return;
  }

  const pool = getPool();
  if (!pool) {
    res.json({ period, [category]: [] });
    return;
  }

  try {
    // Summary stats (only on first page)
    let summary: { totalPlays: number; uniqueCount: number } | undefined;
    if (offset === 0) {
      const genreFilter = category === 'genres' ? ' AND genre IS NOT NULL' : '';
      const uniqueExpr =
        category === 'artists' ? 'COUNT(DISTINCT artist)'
        : category === 'genres' ? 'COUNT(DISTINCT genre)'
        : 'COUNT(DISTINCT (title, artist))';
      const { rows: statsRows } = await pool.query(
        `SELECT COUNT(*)::int AS total_plays, ${uniqueExpr}::int AS unique_count
         FROM song_plays WHERE ${whereClause}${genreFilter}`,
      );
      summary = {
        totalPlays: statsRows[0]?.total_plays ?? 0,
        uniqueCount: statsRows[0]?.unique_count ?? 0,
      };
    }

    if (category === 'artists') {
      const { rows } = await pool.query(
        `SELECT
           artist,
           COUNT(*)::int AS play_count,
           COUNT(DISTINCT title)::int AS song_count,
           MAX(album_art_url) AS album_art_url,
           MODE() WITHIN GROUP (ORDER BY country) AS top_country,
           MAX(played_at) AS last_played
         FROM song_plays
         WHERE ${whereClause}
         GROUP BY artist
         ORDER BY play_count DESC, MAX(played_at) DESC
         LIMIT $1 OFFSET $2`,
        [limit, offset],
      );

      res.json({
        period,
        ...(summary && { summary }),
        artists: rows.map((row, i) => ({
          rank: offset + i + 1,
          artist: row.artist,
          playCount: row.play_count,
          songCount: row.song_count,
          albumArtUrl: row.album_art_url,
          topCountry: row.top_country,
          lastPlayed: row.last_played,
        })),
      });
    } else if (category === 'genres') {
      const { rows } = await pool.query(
        `SELECT
           genre,
           COUNT(*)::int AS play_count,
           COUNT(DISTINCT artist)::int AS artist_count,
           MODE() WITHIN GROUP (ORDER BY country) AS top_country,
           MAX(played_at) AS last_played
         FROM song_plays
         WHERE ${whereClause} AND genre IS NOT NULL
         GROUP BY genre
         ORDER BY play_count DESC, MAX(played_at) DESC
         LIMIT $1 OFFSET $2`,
        [limit, offset],
      );

      res.json({
        period,
        ...(summary && { summary }),
        genres: rows.map((row, i) => ({
          rank: offset + i + 1,
          genre: row.genre,
          playCount: row.play_count,
          artistCount: row.artist_count,
          topCountry: row.top_country,
          lastPlayed: row.last_played,
        })),
      });
    } else {
      // Default: songs
      const { rows } = await pool.query(
        `SELECT
           title,
           artist,
           MAX(album) AS album,
           MAX(album_art_url) AS album_art_url,
           COUNT(*)::int AS play_count,
           MODE() WITHIN GROUP (ORDER BY country) AS top_country,
           MAX(played_at) AS last_played
         FROM song_plays
         WHERE ${whereClause}
         GROUP BY title, artist
         ORDER BY play_count DESC, MAX(played_at) DESC
         LIMIT $1 OFFSET $2`,
        [limit, offset],
      );

      res.json({
        period,
        ...(summary && { summary }),
        songs: rows.map((row, i) => ({
          rank: offset + i + 1,
          title: row.title,
          artist: row.artist,
          album: row.album,
          albumArtUrl: row.album_art_url,
          playCount: row.play_count,
          topCountry: row.top_country,
          lastPlayed: row.last_played,
        })),
      });
    }
  } catch (err) {
    console.error('[leaderboard] Query failed:', err);
    res.status(500).json({ error: 'Leaderboard query failed' });
  }
});
