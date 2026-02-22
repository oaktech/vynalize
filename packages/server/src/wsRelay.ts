import { WebSocketServer, WebSocket } from 'ws';
import crypto from 'crypto';
import type { Server } from 'http';
import { getRedis, getSubscriber } from './services/redis.js';
import {
  createSession,
  sessionExists,
  ensureSession,
  cacheState,
  getState,
  touchSession,
} from './services/sessionManager.js';
import { getSettings } from './services/settings.js';

const OPEN_SESSION = '__open__';
const MAX_MESSAGE_SIZE = 50 * 1024; // 50 KB
const VALID_MESSAGE_TYPES = new Set([
  'state', 'song', 'beat', 'command', 'visualizer',
  'lyrics', 'video', 'nowPlaying', 'seekTo', 'display',
  'remoteStatus', 'session', 'error', 'ping', 'pong',
  'audioFeatures', 'kioskStatus',
]);

type ClientRole = 'controller' | 'display' | 'viewer';

interface TaggedSocket {
  ws: WebSocket;
  role: ClientRole;
  sessionId: string;
}

const instanceId = crypto.randomUUID();

// Session rooms: sessionId -> Set of connected clients
const rooms = new Map<string, Set<TaggedSocket>>();

// Track cleanup timers for empty rooms
const roomCleanupTimers = new Map<string, NodeJS.Timeout>();

// Grace period before notifying display that all controllers are gone.
// Phones going to sleep kill the TCP connection but reconnect quickly on wake.
const DISCONNECT_GRACE_MS = 15_000;
const disconnectGraceTimers = new Map<string, NodeJS.Timeout>();

// Track kiosk sessions (sessionId of displays connected with ?kiosk=true)
const kioskSessions = new Set<string>();

// Cache latest audio features frame per session (in-memory only, not Redis)
const latestAudioFeatures = new Map<string, string>();

// Track Redis channel subscriptions
const subscribedChannels = new Set<string>();

function getRoom(sessionId: string): Set<TaggedSocket> {
  let room = rooms.get(sessionId);
  if (!room) {
    room = new Set();
    rooms.set(sessionId, room);
  }
  return room;
}

function broadcastToRoom(
  sessionId: string,
  msg: string,
  senderRole: ClientRole,
  excludeWs?: WebSocket,
): void {
  const room = rooms.get(sessionId);
  if (!room) return;

  // Display messages go to controllers AND viewers
  if (senderRole === 'display') {
    for (const client of room) {
      if ((client.role === 'controller' || client.role === 'viewer') && client.ws !== excludeWs && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(msg);
      }
    }
  } else {
    // Controller/viewer messages go to displays only
    const targetRole: ClientRole = 'display';
    for (const client of room) {
      if (client.role === targetRole && client.ws !== excludeWs && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(msg);
      }
    }
  }
}

function sendToRole(sessionId: string, role: ClientRole, msg: string): void {
  const room = rooms.get(sessionId);
  if (!room) return;
  for (const client of room) {
    if (client.role === role && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(msg);
    }
  }
}

function countRole(sessionId: string, role: ClientRole): number {
  const room = rooms.get(sessionId);
  if (!room) return 0;
  let n = 0;
  for (const client of room) {
    if (client.role === role) n++;
  }
  return n;
}

async function subscribeToChannel(sessionId: string): Promise<void> {
  const channel = `ws:relay:${sessionId}`;
  if (subscribedChannels.has(channel)) return;

  const sub = getSubscriber();
  if (!sub) return;

  subscribedChannels.add(channel);
  await sub.subscribe(channel);
}

function unsubscribeFromChannel(sessionId: string): void {
  const channel = `ws:relay:${sessionId}`;
  if (!subscribedChannels.has(channel)) return;

  const sub = getSubscriber();
  if (!sub) return;

  subscribedChannels.delete(channel);
  sub.unsubscribe(channel).catch(() => {});
}

function scheduleRoomCleanup(sessionId: string): void {
  const existing = roomCleanupTimers.get(sessionId);
  if (existing) clearTimeout(existing);

  const timer = setTimeout(() => {
    const room = rooms.get(sessionId);
    if (!room || room.size === 0) {
      rooms.delete(sessionId);
      roomCleanupTimers.delete(sessionId);
      kioskSessions.delete(sessionId);
      latestAudioFeatures.delete(sessionId);
      unsubscribeFromChannel(sessionId);
    }
  }, 60_000);

  roomCleanupTimers.set(sessionId, timer);
}

function cancelRoomCleanup(sessionId: string): void {
  const timer = roomCleanupTimers.get(sessionId);
  if (timer) {
    clearTimeout(timer);
    roomCleanupTimers.delete(sessionId);
  }
}

function scheduleDisconnectGrace(sessionId: string): void {
  // Already have a pending grace timer — let it run
  if (disconnectGraceTimers.has(sessionId)) return;

  const timer = setTimeout(() => {
    disconnectGraceTimers.delete(sessionId);
    const remaining = countRole(sessionId, 'controller');
    sendToRole(sessionId, 'display', JSON.stringify({
      type: 'remoteStatus',
      connected: remaining > 0,
      controllers: remaining,
    }));
  }, DISCONNECT_GRACE_MS);

  disconnectGraceTimers.set(sessionId, timer);
}

function cancelDisconnectGrace(sessionId: string): void {
  const timer = disconnectGraceTimers.get(sessionId);
  if (timer) {
    clearTimeout(timer);
    disconnectGraceTimers.delete(sessionId);
  }
}

/** Returns the session ID of the first active kiosk, or null if none. */
export function getActiveKioskSession(): string | null {
  for (const sessionId of kioskSessions) {
    const room = rooms.get(sessionId);
    if (room && room.size > 0) return sessionId;
  }
  return null;
}

export function attachWebSocket(server: Server): void {
  const wss = new WebSocketServer({ noServer: true });

  // Listen for cross-instance messages via Redis pub/sub
  const sub = getSubscriber();
  if (sub) {
    sub.on('message', (channel: string, message: string) => {
      const sessionId = channel.replace('ws:relay:', '');

      let parsed: { fromInstanceId?: string; senderRole?: ClientRole; payload?: string };
      try {
        parsed = JSON.parse(message);
      } catch {
        return;
      }

      // Ignore messages from this instance
      if (parsed.fromInstanceId === instanceId) return;
      if (!parsed.payload || !parsed.senderRole) return;

      broadcastToRoom(sessionId, parsed.payload, parsed.senderRole);
    });
  }

  server.on('upgrade', (req, socket, head) => {
    if (!req.url?.startsWith('/ws')) {
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req);
    });
  });

  wss.on('connection', (ws, req) => {
    const url = new URL(req.url || '/', `http://${req.headers.host}`);
    const roleParam = url.searchParams.get('role') || 'controller';
    const role = (['controller', 'display', 'viewer'].includes(roleParam) ? roleParam : 'controller') as ClientRole;
    const sessionParam = url.searchParams.get('session');
    const isKiosk = url.searchParams.get('kiosk') === 'true';

    // Register message handler synchronously to avoid race with async setup.
    // Messages that arrive before setup completes are buffered and replayed.
    let resolvedSessionId: string | null = null;
    let setupDone = false;
    const buffered: string[] = [];

    function processMessage(msg: string) {
      if (!resolvedSessionId) return;
      if (msg.length > MAX_MESSAGE_SIZE) return;

      let parsed: { type?: string };
      try {
        parsed = JSON.parse(msg);
      } catch {
        return;
      }

      if (!parsed.type || typeof parsed.type !== 'string') return;
      if (!VALID_MESSAGE_TYPES.has(parsed.type)) return;

      touchSession(resolvedSessionId).catch(() => {});

      if (role === 'display') {
        if (parsed.type === 'state' || parsed.type === 'song' || parsed.type === 'beat') {
          cacheState(resolvedSessionId, parsed.type, msg).catch(() => {});
        }
        if (parsed.type === 'audioFeatures') {
          latestAudioFeatures.set(resolvedSessionId, msg);
        }
      }

      // Broadcast to local room
      broadcastToRoom(resolvedSessionId, msg, role, ws);

      // Publish to Redis for cross-instance routing
      const redis = getRedis();
      if (redis) {
        const envelope = JSON.stringify({
          fromInstanceId: instanceId,
          senderRole: role,
          payload: msg,
        });
        redis.publish(`ws:relay:${resolvedSessionId}`, envelope).catch(() => {});
      }
    }

    ws.on('message', (raw) => {
      const msg = raw.toString();
      if (!setupDone) {
        buffered.push(msg);
        return;
      }
      processMessage(msg);
    });

    ws.on('close', () => {
      if (!resolvedSessionId) return;
      const room = rooms.get(resolvedSessionId);
      if (room) {
        for (const c of room) {
          if (c.ws === ws) { room.delete(c); break; }
        }
        console.log(`[ws] ${role} left session ${resolvedSessionId} (${room.size} in room)`);

        // Notify displays when a controller disconnects
        if (role === 'controller') {
          const remaining = countRole(resolvedSessionId, 'controller');
          if (remaining > 0) {
            // Still have controllers — update count immediately
            cancelDisconnectGrace(resolvedSessionId);
            sendToRole(resolvedSessionId, 'display', JSON.stringify({
              type: 'remoteStatus',
              connected: true,
              controllers: remaining,
            }));
          } else {
            // Last controller left — start grace period before notifying display.
            // Phones going to sleep drop the TCP connection but reconnect on wake.
            scheduleDisconnectGrace(resolvedSessionId);
          }
        }

        // Kiosk display disconnecting — notify viewers
        if (role === 'display' && isKiosk) {
          kioskSessions.delete(resolvedSessionId);
          latestAudioFeatures.delete(resolvedSessionId);
          sendToRole(resolvedSessionId, 'viewer', JSON.stringify({
            type: 'kioskStatus',
            connected: false,
          }));
        }

        if (room.size === 0) {
          scheduleRoomCleanup(resolvedSessionId);
        }
      }
    });

    // Async setup — resolve session, join room, subscribe
    (async () => {
      let sessionId: string;

      if (!getSettings().requireCode) {
        // No code required — everyone shares a single session
        await ensureSession(OPEN_SESSION);
        sessionId = OPEN_SESSION;
      } else if (role === 'display') {
        if (sessionParam && (await sessionExists(sessionParam))) {
          sessionId = sessionParam;
        } else {
          sessionId = createSession();
          ws.send(JSON.stringify({ type: 'session', sessionId }));
        }
      } else {
        if (sessionParam && (await sessionExists(sessionParam))) {
          sessionId = sessionParam;
        } else if (sessionParam) {
          ws.send(JSON.stringify({ type: 'error', message: 'Invalid session code' }));
          ws.close(4001, 'Invalid session');
          return;
        } else {
          sessionId = createSession();
        }
      }

      resolvedSessionId = sessionId;
      const client: TaggedSocket = { ws, role, sessionId };
      const room = getRoom(sessionId);
      room.add(client);
      cancelRoomCleanup(sessionId);

      console.log(`[ws] ${role} joined session ${sessionId} (${room.size} in room)`);

      await subscribeToChannel(sessionId);

      // Register kiosk session
      if (role === 'display' && isKiosk) {
        kioskSessions.add(sessionId);
      }

      // Send cached state to new controllers
      if (role === 'controller') {
        // Cancel any pending disconnect grace — controller is (re)connecting
        cancelDisconnectGrace(sessionId);

        try {
          const cached = await getState(sessionId);
          if (cached.state) ws.send(cached.state);
          if (cached.song) ws.send(cached.song);
          if (cached.beat) ws.send(cached.beat);
        } catch {}

        sendToRole(sessionId, 'display', JSON.stringify({
          type: 'remoteStatus',
          connected: true,
          controllers: countRole(sessionId, 'controller'),
        }));
      }

      // Send cached state + latest audio frame to new viewers
      if (role === 'viewer') {
        try {
          const cached = await getState(sessionId);
          if (cached.state) ws.send(cached.state);
          if (cached.song) ws.send(cached.song);
          if (cached.beat) ws.send(cached.beat);
        } catch {}

        const audioFrame = latestAudioFeatures.get(sessionId);
        if (audioFrame) ws.send(audioFrame);

        // Let viewer know kiosk is online
        ws.send(JSON.stringify({
          type: 'kioskStatus',
          connected: kioskSessions.has(sessionId),
        }));
      }

      // Flush buffered messages
      setupDone = true;
      for (const msg of buffered) processMessage(msg);
      buffered.length = 0;
    })();
  });

  console.log('[ws] WebSocket relay attached (session-based)');
}
