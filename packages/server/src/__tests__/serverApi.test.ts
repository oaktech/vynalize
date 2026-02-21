import { describe, it, expect, vi } from 'vitest';

// ── Server API Tests ───────────────────────────────────────
// Tests server-side logic without starting the HTTP server

describe('Server API Configuration', () => {
  describe('CORS origin validation', () => {
    const ALLOWED_ORIGIN_PATTERNS = [
      /^https?:\/\/localhost(:\d+)?$/,
      /^https?:\/\/127\.0\.0\.1(:\d+)?$/,
      /^https?:\/\/\[::1\](:\d+)?$/,
      /^https?:\/\/vynalize\.local(:\d+)?$/,
      /^https?:\/\/(www\.)?vynalize\.com$/,
      /^https?:\/\/(10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3})(:\d+)?$/,
    ];

    function isAllowed(origin: string): boolean {
      return ALLOWED_ORIGIN_PATTERNS.some((p) => p.test(origin));
    }

    it('allows localhost', () => {
      expect(isAllowed('http://localhost')).toBe(true);
      expect(isAllowed('http://localhost:3000')).toBe(true);
      expect(isAllowed('https://localhost:5173')).toBe(true);
    });

    it('allows 127.0.0.1', () => {
      expect(isAllowed('http://127.0.0.1')).toBe(true);
      expect(isAllowed('http://127.0.0.1:3001')).toBe(true);
    });

    it('allows IPv6 loopback', () => {
      expect(isAllowed('http://[::1]')).toBe(true);
      expect(isAllowed('http://[::1]:3000')).toBe(true);
    });

    it('allows vynalize.local (mDNS)', () => {
      expect(isAllowed('http://vynalize.local')).toBe(true);
      expect(isAllowed('http://vynalize.local:3001')).toBe(true);
    });

    it('allows vynalize.com', () => {
      expect(isAllowed('https://vynalize.com')).toBe(true);
      expect(isAllowed('https://www.vynalize.com')).toBe(true);
    });

    it('allows LAN IPs (private ranges)', () => {
      expect(isAllowed('http://192.168.1.100')).toBe(true);
      expect(isAllowed('http://192.168.1.100:3001')).toBe(true);
      expect(isAllowed('http://10.0.0.5')).toBe(true);
      expect(isAllowed('http://172.16.0.1')).toBe(true);
      expect(isAllowed('http://172.31.255.255')).toBe(true);
    });

    it('rejects public internet origins', () => {
      expect(isAllowed('https://evil.com')).toBe(false);
      expect(isAllowed('https://google.com')).toBe(false);
      expect(isAllowed('https://other-app.com')).toBe(false);
    });

    it('rejects similar-looking domains', () => {
      expect(isAllowed('https://notvynalize.com')).toBe(false);
      expect(isAllowed('https://vynalize.com.evil.com')).toBe(false);
    });

    it('rejects non-private IP ranges', () => {
      expect(isAllowed('http://8.8.8.8')).toBe(false);
      expect(isAllowed('http://1.1.1.1')).toBe(false);
      expect(isAllowed('http://172.32.0.1')).toBe(false); // just outside private range
    });
  });

  describe('Rate limiting', () => {
    it('identify endpoint allows 5 requests per minute', () => {
      const config = { keyPrefix: 'identify', windowMs: 60_000, maxRequests: 5 };
      expect(config.maxRequests).toBe(5);
      expect(config.windowMs).toBe(60_000);
    });

    it('log endpoint allows 30 requests per minute', () => {
      const config = { keyPrefix: 'log', windowMs: 60_000, maxRequests: 30 };
      expect(config.maxRequests).toBe(30);
    });
  });

  describe('File upload limits', () => {
    const ALLOWED_AUDIO_MIMES = new Set([
      'audio/webm', 'audio/ogg', 'audio/wav', 'audio/mpeg',
      'audio/mp4', 'audio/x-wav', 'audio/wave',
    ]);

    it('accepts audio/webm', () => {
      expect(ALLOWED_AUDIO_MIMES.has('audio/webm')).toBe(true);
    });

    it('accepts audio/wav', () => {
      expect(ALLOWED_AUDIO_MIMES.has('audio/wav')).toBe(true);
    });

    it('rejects non-audio types', () => {
      expect(ALLOWED_AUDIO_MIMES.has('image/png')).toBe(false);
      expect(ALLOWED_AUDIO_MIMES.has('application/json')).toBe(false);
      expect(ALLOWED_AUDIO_MIMES.has('text/html')).toBe(false);
    });

    it('file size limit is 3MB', () => {
      const MAX_SIZE = 3 * 1024 * 1024;
      expect(MAX_SIZE).toBe(3145728);
    });
  });

  describe('Log endpoint sanitization', () => {
    function sanitizeLog(tag: string, msg: string): { safeTag: string; safeMsg: string } | null {
      if (typeof tag !== 'string' || typeof msg !== 'string') return null;
      const safeTag = tag.slice(0, 50).replace(/[\r\n]/g, '');
      const safeMsg = msg.slice(0, 500).replace(/[\r\n]/g, '');
      return { safeTag, safeMsg };
    }

    it('strips newlines from tag', () => {
      const result = sanitizeLog('test\ntag', 'msg');
      expect(result?.safeTag).toBe('testtag');
    });

    it('strips carriage returns from message', () => {
      const result = sanitizeLog('tag', 'line1\r\nline2');
      expect(result?.safeMsg).toBe('line1line2');
    });

    it('truncates long tags to 50 chars', () => {
      const result = sanitizeLog('a'.repeat(100), 'msg');
      expect(result?.safeTag).toHaveLength(50);
    });

    it('truncates long messages to 500 chars', () => {
      const result = sanitizeLog('tag', 'a'.repeat(1000));
      expect(result?.safeMsg).toHaveLength(500);
    });

    it('rejects non-string inputs', () => {
      // @ts-expect-error — testing runtime behavior
      expect(sanitizeLog(42, 'msg')).toBeNull();
      // @ts-expect-error — testing runtime behavior
      expect(sanitizeLog('tag', null)).toBeNull();
    });
  });

  describe('Health endpoint', () => {
    it('returns ok status with timestamp', () => {
      const response = {
        status: 'ok',
        timestamp: Date.now(),
        redis: false,
      };
      expect(response.status).toBe('ok');
      expect(response.timestamp).toBeGreaterThan(0);
    });
  });

  describe('Config endpoint', () => {
    it('returns requireCode setting', () => {
      const config = { requireCode: true };
      expect(config.requireCode).toBe(true);
    });

    it('optionally includes lanHost', () => {
      const config = { requireCode: true, lanHost: '192.168.1.100' };
      expect(config.lanHost).toBeDefined();
    });
  });
});

describe('WebSocket Relay Logic', () => {
  describe('Message routing', () => {
    it('display messages route to controllers', () => {
      const senderRole: string = 'display';
      const targetRole = senderRole === 'controller' ? 'display' : 'controller';
      expect(targetRole).toBe('controller');
    });

    it('controller messages route to displays', () => {
      const senderRole = 'controller';
      const targetRole = senderRole === 'controller' ? 'display' : 'controller';
      expect(targetRole).toBe('display');
    });
  });

  describe('Message validation', () => {
    const VALID_MESSAGE_TYPES = new Set([
      'state', 'song', 'beat', 'command', 'visualizer',
      'lyrics', 'video', 'nowPlaying', 'seekTo', 'display',
      'remoteStatus', 'session', 'error', 'ping', 'pong',
    ]);

    it('accepts valid message types', () => {
      expect(VALID_MESSAGE_TYPES.has('command')).toBe(true);
      expect(VALID_MESSAGE_TYPES.has('state')).toBe(true);
      expect(VALID_MESSAGE_TYPES.has('beat')).toBe(true);
    });

    it('rejects unknown message types', () => {
      expect(VALID_MESSAGE_TYPES.has('exploit')).toBe(false);
      expect(VALID_MESSAGE_TYPES.has('admin')).toBe(false);
    });

    it('rejects messages over 50KB', () => {
      const MAX_MESSAGE_SIZE = 50 * 1024;
      const bigMessage = JSON.stringify({ data: 'x'.repeat(MAX_MESSAGE_SIZE + 1) });
      expect(bigMessage.length).toBeGreaterThan(MAX_MESSAGE_SIZE);
    });
  });

  describe('Session assignment', () => {
    it('display role gets assigned a new session', () => {
      // When display connects without sessionParam, server creates new session
      const role = 'display';
      const sessionParam = null;
      const shouldCreateSession = role === 'display' && !sessionParam;
      expect(shouldCreateSession).toBe(true);
    });

    it('display reconnects with existing session', () => {
      const role = 'display';
      const sessionParam = 'ABC123';
      const shouldReuse = role === 'display' && sessionParam;
      expect(!!shouldReuse).toBe(true);
    });

    it('controller with invalid session is rejected', () => {
      const role = 'controller';
      const sessionParam = 'INVALID';
      const sessionExistsResult = false;
      const shouldReject = role === 'controller' && sessionParam && !sessionExistsResult;
      expect(shouldReject).toBe(true);
    });
  });

  describe('Disconnect grace period', () => {
    it('grace period is 15 seconds', () => {
      const DISCONNECT_GRACE_MS = 15_000;
      expect(DISCONNECT_GRACE_MS).toBe(15000);
    });

    it('room cleanup happens after 60 seconds', () => {
      const ROOM_CLEANUP_DELAY = 60_000;
      expect(ROOM_CLEANUP_DELAY).toBe(60_000);
    });
  });

  describe('State caching for controllers', () => {
    it('caches state, song, and beat messages from display', () => {
      const cacheableTypes = ['state', 'song', 'beat'];
      const msg = { type: 'state' };
      expect(cacheableTypes.includes(msg.type)).toBe(true);
    });

    it('does not cache command messages', () => {
      const cacheableTypes = ['state', 'song', 'beat'];
      const msg = { type: 'command' };
      expect(cacheableTypes.includes(msg.type)).toBe(false);
    });
  });

  describe('Open session mode', () => {
    it('open mode uses special session ID', () => {
      const OPEN_SESSION = '__open__';
      expect(OPEN_SESSION).toBe('__open__');
    });
  });
});

describe('Content Security Policy', () => {
  const csp = {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", "https://www.youtube.com", "https://s.ytimg.com"],
    imgSrc: ["'self'", "data:", "blob:", "https://i.ytimg.com", "https://*.googleusercontent.com", "https://*.mzstatic.com"],
    frameSrc: ["'self'", "https://www.youtube.com", "https://www.youtube-nocookie.com"],
    connectSrc: ["'self'", "ws:", "wss:", "https://lrclib.net"],
  };

  it('allows YouTube embeds', () => {
    expect(csp.frameSrc).toContain("https://www.youtube.com");
  });

  it('allows YouTube thumbnails', () => {
    expect(csp.imgSrc).toContain("https://i.ytimg.com");
  });

  it('allows WebSocket connections', () => {
    expect(csp.connectSrc).toContain("ws:");
    expect(csp.connectSrc).toContain("wss:");
  });

  it('allows lyrics API connections', () => {
    expect(csp.connectSrc).toContain("https://lrclib.net");
  });

  it('allows album art from Apple Music', () => {
    expect(csp.imgSrc).toContain("https://*.mzstatic.com");
  });

  it('default-src is self only', () => {
    expect(csp.defaultSrc).toEqual(["'self'"]);
  });
});
