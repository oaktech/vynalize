import { getPool } from './db.js';
import { encrypt, decrypt } from './encryption.js';

export interface User {
  id: number;
  google_id: string;
  email: string;
  display_name: string;
  avatar_url: string | null;
  has_youtube_api_key: boolean;
  created_at: Date;
  updated_at: Date;
}

interface GoogleProfile {
  id: string;
  emails?: Array<{ value: string }>;
  displayName: string;
  photos?: Array<{ value: string }>;
}

export async function findOrCreateUser(profile: GoogleProfile): Promise<User> {
  const pool = getPool()!;
  const email = profile.emails?.[0]?.value ?? '';
  const displayName = profile.displayName;
  const avatarUrl = profile.photos?.[0]?.value ?? null;

  const { rows } = await pool.query(
    `INSERT INTO users (google_id, email, display_name, avatar_url)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (google_id) DO UPDATE SET
       email = EXCLUDED.email,
       display_name = EXCLUDED.display_name,
       avatar_url = EXCLUDED.avatar_url,
       updated_at = NOW()
     RETURNING *`,
    [profile.id, email, displayName, avatarUrl],
  );

  return toUser(rows[0]);
}

export async function getUserById(id: number): Promise<User | null> {
  const pool = getPool();
  if (!pool) return null;

  const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
  if (rows.length === 0) return null;
  return toUser(rows[0]);
}

export async function saveUserApiKey(userId: number, apiKey: string): Promise<void> {
  const pool = getPool()!;
  const { ciphertext, iv, tag } = encrypt(apiKey);

  await pool.query(
    `UPDATE users SET
       youtube_api_key_enc = $1,
       youtube_api_key_iv = $2,
       youtube_api_key_tag = $3,
       updated_at = NOW()
     WHERE id = $4`,
    [ciphertext, iv, tag, userId],
  );
}

export async function getUserApiKey(userId: number): Promise<string | null> {
  const pool = getPool()!;
  const { rows } = await pool.query(
    'SELECT youtube_api_key_enc, youtube_api_key_iv, youtube_api_key_tag FROM users WHERE id = $1',
    [userId],
  );

  const row = rows[0];
  if (!row?.youtube_api_key_enc) return null;

  return decrypt(row.youtube_api_key_enc, row.youtube_api_key_iv, row.youtube_api_key_tag);
}

export async function deleteUserApiKey(userId: number): Promise<void> {
  const pool = getPool()!;
  await pool.query(
    `UPDATE users SET
       youtube_api_key_enc = NULL,
       youtube_api_key_iv = NULL,
       youtube_api_key_tag = NULL,
       updated_at = NOW()
     WHERE id = $1`,
    [userId],
  );
}

function toUser(row: Record<string, unknown>): User {
  return {
    id: row.id as number,
    google_id: row.google_id as string,
    email: row.email as string,
    display_name: row.display_name as string,
    avatar_url: row.avatar_url as string | null,
    has_youtube_api_key: row.youtube_api_key_enc != null,
    created_at: row.created_at as Date,
    updated_at: row.updated_at as Date,
  };
}
