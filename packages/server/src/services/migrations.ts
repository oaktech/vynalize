import { getPool } from './db.js';

const MIGRATIONS: { name: string; sql: string }[] = [
  {
    name: '000_genre_column',
    sql: `ALTER TABLE song_plays ADD COLUMN IF NOT EXISTS genre TEXT;`,
  },
  {
    name: '000_drop_unused_geo_columns',
    sql: `
      ALTER TABLE song_plays DROP COLUMN IF EXISTS city;
      ALTER TABLE song_plays DROP COLUMN IF EXISTS region;
      ALTER TABLE song_plays DROP COLUMN IF EXISTS country_code;
    `,
  },
  {
    name: '001_auth_tables',
    sql: `
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        google_id TEXT UNIQUE NOT NULL,
        email TEXT NOT NULL,
        display_name TEXT NOT NULL,
        avatar_url TEXT,
        youtube_api_key_enc BYTEA,
        youtube_api_key_iv  BYTEA,
        youtube_api_key_tag BYTEA,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS user_quota (
        user_id INT REFERENCES users(id),
        quota_date DATE DEFAULT CURRENT_DATE,
        search_count INT DEFAULT 0,
        PRIMARY KEY (user_id, quota_date)
      );

      CREATE TABLE IF NOT EXISTS session (
        sid VARCHAR PRIMARY KEY,
        sess JSON NOT NULL,
        expire TIMESTAMP(6) NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_session_expire ON session (expire);
    `,
  },
];

export async function runMigrations(): Promise<void> {
  const pool = getPool();
  if (!pool) return;

  // Create migrations tracking table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS migrations (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  for (const migration of MIGRATIONS) {
    const { rows } = await pool.query(
      'SELECT 1 FROM migrations WHERE name = $1',
      [migration.name],
    );
    if (rows.length > 0) continue;

    console.log(`[migrations] Applying: ${migration.name}`);
    await pool.query(migration.sql);
    await pool.query('INSERT INTO migrations (name) VALUES ($1)', [migration.name]);
    console.log(`[migrations] Applied: ${migration.name}`);
  }
}
