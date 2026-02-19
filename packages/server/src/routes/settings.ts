import { Router } from 'express';
import { getSettings, saveSettings, type Settings } from '../services/settings.js';

export const settingsRouter = Router();

function maskKey(key: string): string {
  if (key.length <= 8) return '****';
  return key.slice(0, 4) + '****' + key.slice(-4);
}

/** GET / — return current settings (API key masked) */
settingsRouter.get('/', (_req, res) => {
  const s = getSettings();
  res.json({
    youtubeApiKey: s.youtubeApiKey ? maskKey(s.youtubeApiKey) : '',
    requireCode: s.requireCode,
  });
});

/** PUT / — partial update, validate types, save */
settingsRouter.put('/', async (req, res) => {
  const body = req.body as Record<string, unknown>;
  const update: Partial<Settings> = {};

  if ('youtubeApiKey' in body) {
    if (typeof body.youtubeApiKey !== 'string') {
      res.status(400).json({ error: 'youtubeApiKey must be a string' });
      return;
    }
    update.youtubeApiKey = body.youtubeApiKey;
  }

  if ('requireCode' in body) {
    if (typeof body.requireCode !== 'boolean') {
      res.status(400).json({ error: 'requireCode must be a boolean' });
      return;
    }
    update.requireCode = body.requireCode;
  }

  if (Object.keys(update).length === 0) {
    res.status(400).json({ error: 'No valid fields provided' });
    return;
  }

  try {
    const saved = await saveSettings(update);
    res.json({
      youtubeApiKey: saved.youtubeApiKey ? maskKey(saved.youtubeApiKey) : '',
      requireCode: saved.requireCode,
    });
  } catch (err) {
    console.error('[settings] Failed to save:', err);
    res.status(500).json({ error: 'Failed to save settings' });
  }
});
