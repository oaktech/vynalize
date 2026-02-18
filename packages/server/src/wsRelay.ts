import { WebSocketServer, WebSocket } from 'ws';
import crypto from 'crypto';
import type { Server } from 'http';
import { getRedis, getSubscriber } from './services/redis.js';
import {
  createSession,
  sessionExists,
  cacheState,
  getState,
  touchSession,
} from './services/sessionManager.js';

type ClientRole = 'controller' | 'display';

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

  const targetRole: ClientRole = senderRole === 'controller' ? 'display' : 'controller';
  for (const client of room) {
    if (client.role === targetRole && client.ws !== excludeWs && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(msg);
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
    const role = (url.searchParams.get('role') as ClientRole) || 'controller';
    const sessionParam = url.searchParams.get('session');

    // Register message handler synchronously to avoid race with async setup.
    // Messages that arrive before setup completes are buffered and replayed.
    let resolvedSessionId: string | null = null;
    let setupDone = false;
    const buffered: string[] = [];

    function processMessage(msg: string) {
      if (!resolvedSessionId) return;
      let parsed: { type?: string };
      try {
        parsed = JSON.parse(msg);
      } catch {
        return;
      }

      touchSession(resolvedSessionId).catch(() => {});

      if (role === 'display') {
        if (parsed.type === 'state' || parsed.type === 'song' || parsed.type === 'beat') {
          cacheState(resolvedSessionId, parsed.type, msg).catch(() => {});
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
          sendToRole(resolvedSessionId, 'display', JSON.stringify({
            type: 'remoteStatus',
            connected: remaining > 0,
            controllers: remaining,
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

      if (role === 'display') {
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

      // Send cached state to new controllers
      if (role === 'controller') {
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

      // Flush buffered messages
      setupDone = true;
      for (const msg of buffered) processMessage(msg);
      buffered.length = 0;
    })();
  });

  console.log('[ws] WebSocket relay attached (session-based)');
}
