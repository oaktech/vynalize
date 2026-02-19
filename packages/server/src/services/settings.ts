import { readFile, writeFile } from 'fs/promises';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SETTINGS_PATH = resolve(__dirname, '../../../../settings.json');

export interface Settings {
  youtubeApiKey: string;
  requireCode: boolean;
}

let cache: Settings = {
  youtubeApiKey: '',
  requireCode: true,
};

/** Read settings.json from disk, fall back to env vars for missing keys. */
export async function loadSettings(): Promise<void> {
  const defaults: Settings = {
    youtubeApiKey: process.env.YOUTUBE_API_KEY || '',
    requireCode: process.env.REQUIRE_CODE !== 'false',
  };

  try {
    const raw = await readFile(SETTINGS_PATH, 'utf-8');
    const file = JSON.parse(raw) as Partial<Settings>;
    cache = {
      youtubeApiKey: file.youtubeApiKey ?? defaults.youtubeApiKey,
      requireCode: file.requireCode ?? defaults.requireCode,
    };
  } catch {
    // File doesn't exist yet — use env var defaults
    cache = defaults;
  }
}

/** Return cached settings synchronously. */
export function getSettings(): Readonly<Settings> {
  return cache;
}

/** Merge a partial update, write to disk, and update the cache. */
export async function saveSettings(partial: Partial<Settings>): Promise<Settings> {
  cache = { ...cache, ...partial };
  await writeFile(SETTINGS_PATH, JSON.stringify(cache, null, 2) + '\n', 'utf-8');
  return cache;
}
