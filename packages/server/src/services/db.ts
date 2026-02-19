import pg from 'pg';

const { Pool } = pg;

let pool: pg.Pool | null = null;
export let dbAvailable = false;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS song_plays (
  id            SERIAL PRIMARY KEY,
  title         TEXT NOT NULL,
  artist        TEXT NOT NULL,
  album         TEXT,
  album_art_url TEXT,
  city          TEXT,
  region        TEXT,
  country       TEXT,
  country_code  CHAR(2),
  played_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_plays_played_at ON song_plays (played_at);
CREATE INDEX IF NOT EXISTS idx_plays_song ON song_plays (title, artist);
`;

export async function initDb(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.log('[db] DATABASE_URL not set — play tracking disabled');
    return;
  }

  try {
    pool = new Pool({ connectionString: url, max: 10 });
    await pool.query(SCHEMA);
    dbAvailable = true;
    console.log('[db] PostgreSQL connected, song_plays table ready');
  } catch (err) {
    console.error('[db] Failed to connect to PostgreSQL:', err);
    pool = null;
    dbAvailable = false;
  }
}

export function getPool(): pg.Pool | null {
  return pool;
}
