import { Router } from 'express';
import { dbAvailable, getPool } from '../services/db.js';

export const leaderboardRouter = Router();

const PERIOD_FILTERS: Record<string, string> = {
  today: `played_at >= DATE_TRUNC('day', NOW() AT TIME ZONE 'UTC')`,
  week: `played_at >= NOW() - INTERVAL '7 days'`,
  month: `played_at >= NOW() - INTERVAL '30 days'`,
  year: `played_at >= NOW() - INTERVAL '365 days'`,
  all: '1=1',
};

leaderboardRouter.get('/', async (req, res) => {
  if (!dbAvailable) {
    res.json({ period: req.query.period || 'all', songs: [] });
    return;
  }

  const period = String(req.query.period || 'all');
  const limit = Math.min(Math.max(parseInt(String(req.query.limit || '25'), 10) || 25, 1), 100);

  const whereClause = PERIOD_FILTERS[period];
  if (!whereClause) {
    res.status(400).json({ error: 'Invalid period. Use: today, week, month, year, all' });
    return;
  }

  const pool = getPool();
  if (!pool) {
    res.json({ period, songs: [] });
    return;
  }

  try {
    const { rows } = await pool.query(
      `SELECT
         title,
         artist,
         MAX(album) AS album,
         MAX(album_art_url) AS album_art_url,
         COUNT(*)::int AS play_count,
         MODE() WITHIN GROUP (ORDER BY city) AS top_city,
         MODE() WITHIN GROUP (ORDER BY country_code) AS top_country
       FROM song_plays
       WHERE ${whereClause}
       GROUP BY title, artist
       ORDER BY play_count DESC, MAX(played_at) DESC
       LIMIT $1`,
      [limit],
    );

    res.json({
      period,
      songs: rows.map((row, i) => ({
        rank: i + 1,
        title: row.title,
        artist: row.artist,
        album: row.album,
        albumArtUrl: row.album_art_url,
        playCount: row.play_count,
        topCity: row.top_city,
        topCountry: row.top_country,
      })),
    });
  } catch (err) {
    console.error('[leaderboard] Query failed:', err);
    res.status(500).json({ error: 'Leaderboard query failed' });
  }
});
