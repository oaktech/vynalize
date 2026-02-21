import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Session Manager Tests ──────────────────────────────────

// Mock Redis to be unavailable (test local-only mode)
vi.mock('../services/redis.js', () => ({
  getRedis: () => null,
  getSubscriber: () => null,
  connectRedis: vi.fn(),
  redisAvailable: false,
}));

describe('Session Manager', () => {
  beforeEach(async () => {
    // Re-import to get fresh module state
    vi.resetModules();
  });

  describe('Session code generation', () => {
    it('generates 6-character session codes', async () => {
      const { createSession } = await import('../services/sessionManager.js');
      const id = createSession();
      expect(id).toHaveLength(6);
    });

    it('uses only readable characters (no I/O/0/1)', async () => {
      const { createSession } = await import('../services/sessionManager.js');
      const readableChars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      for (let i = 0; i < 20; i++) {
        const id = createSession();
        for (const char of id) {
          expect(readableChars).toContain(char);
        }
      }
    });

    it('generates unique codes', async () => {
      const { createSession } = await import('../services/sessionManager.js');
      const codes = new Set<string>();
      for (let i = 0; i < 100; i++) {
        codes.add(createSession());
      }
      // With 30^6 possibilities, 100 codes should all be unique
      expect(codes.size).toBe(100);
    });

    it('codes do not contain ambiguous characters', async () => {
      const { createSession } = await import('../services/sessionManager.js');
      const ambiguous = ['I', 'O', '0', '1'];
      for (let i = 0; i < 50; i++) {
        const id = createSession();
        for (const char of ambiguous) {
          expect(id).not.toContain(char);
        }
      }
    });
  });

  describe('Session persistence (local mode)', () => {
    it('creates and checks session existence', async () => {
      const { createSession, sessionExists } = await import('../services/sessionManager.js');
      const id = createSession();
      const exists = await sessionExists(id);
      expect(exists).toBe(true);
    });

    it('returns false for non-existent session', async () => {
      const { sessionExists } = await import('../services/sessionManager.js');
      const exists = await sessionExists('NONEXISTENT');
      expect(exists).toBe(false);
    });

    it('ensureSession creates new session if needed', async () => {
      const { ensureSession, sessionExists } = await import('../services/sessionManager.js');
      await ensureSession('TESTSESSION');
      const exists = await sessionExists('TESTSESSION');
      expect(exists).toBe(true);
    });

    it('ensureSession is idempotent', async () => {
      const { ensureSession, sessionExists } = await import('../services/sessionManager.js');
      await ensureSession('IDEM');
      await ensureSession('IDEM');
      const exists = await sessionExists('IDEM');
      expect(exists).toBe(true);
    });
  });

  describe('State caching (local mode)', () => {
    it('caches and retrieves state', async () => {
      const { createSession, cacheState, getState } = await import('../services/sessionManager.js');
      const id = createSession();
      const stateData = JSON.stringify({ type: 'state', data: { visualizerMode: 'nebula' } });
      await cacheState(id, 'state', stateData);
      const cached = await getState(id);
      expect(cached.state).toBe(stateData);
    });

    it('caches song data separately', async () => {
      const { createSession, cacheState, getState } = await import('../services/sessionManager.js');
      const id = createSession();
      const songData = JSON.stringify({ type: 'song', data: { title: 'Test' } });
      await cacheState(id, 'song', songData);
      const cached = await getState(id);
      expect(cached.song).toBe(songData);
      expect(cached.state).toBeNull();
    });

    it('caches beat data separately', async () => {
      const { createSession, cacheState, getState } = await import('../services/sessionManager.js');
      const id = createSession();
      const beatData = JSON.stringify({ type: 'beat', bpm: 120 });
      await cacheState(id, 'beat', beatData);
      const cached = await getState(id);
      expect(cached.beat).toBe(beatData);
    });

    it('returns nulls for session with no cached data', async () => {
      const { createSession, getState } = await import('../services/sessionManager.js');
      const id = createSession();
      const cached = await getState(id);
      expect(cached.state).toBeNull();
      expect(cached.song).toBeNull();
      expect(cached.beat).toBeNull();
    });

    it('overwrites previous cached state', async () => {
      const { createSession, cacheState, getState } = await import('../services/sessionManager.js');
      const id = createSession();
      await cacheState(id, 'state', 'old');
      await cacheState(id, 'state', 'new');
      const cached = await getState(id);
      expect(cached.state).toBe('new');
    });
  });
});
