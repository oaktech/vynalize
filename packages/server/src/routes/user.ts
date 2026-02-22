import { Router } from 'express';
import { authRequired, getUserId } from '../middleware/auth.js';
import { saveUserApiKey, getUserApiKey, deleteUserApiKey } from '../services/users.js';
import { getQuotaUsage } from '../services/quota.js';

export const userRouter = Router();

// All user routes require authentication
userRouter.use(authRequired);

// Get YouTube API key status + quota usage
userRouter.get('/youtube-key', async (req, res) => {
  const userId = getUserId(req)!;
  try {
    const hasKey = (await getUserApiKey(userId)) !== null;
    const quota = await getQuotaUsage(userId);

    res.json({
      hasKey,
      quota: hasKey ? null : quota,
    });
  } catch (err) {
    console.error('[user] Failed to get key status:', err);
    res.status(500).json({ error: 'Failed to get key status' });
  }
});

// Save YouTube API key (validates against YouTube API first)
userRouter.put('/youtube-key', async (req, res) => {
  const userId = getUserId(req)!;
  const { apiKey } = req.body;

  if (!apiKey || typeof apiKey !== 'string' || apiKey.length < 10) {
    res.status(400).json({ error: 'Invalid API key' });
    return;
  }

  try {
    // Validate the key by making a cheap API call
    const testUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=test&maxResults=1&key=${encodeURIComponent(apiKey)}`;
    const testRes = await fetch(testUrl);

    if (!testRes.ok) {
      const err = await testRes.json().catch(() => ({}));
      const msg = (err as { error?: { message?: string } })?.error?.message || 'Invalid API key';
      res.status(400).json({ error: msg });
      return;
    }

    await saveUserApiKey(userId, apiKey);
    res.json({ ok: true });
  } catch (err) {
    console.error('[user] Failed to save API key:', err);
    res.status(500).json({ error: 'Failed to save API key' });
  }
});

// Delete YouTube API key
userRouter.delete('/youtube-key', async (req, res) => {
  const userId = getUserId(req)!;
  try {
    await deleteUserApiKey(userId);
    res.json({ ok: true });
  } catch (err) {
    console.error('[user] Failed to delete API key:', err);
    res.status(500).json({ error: 'Failed to delete API key' });
  }
});
