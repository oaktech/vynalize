import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';

type ClientRole = 'controller' | 'display';

interface TaggedSocket {
  ws: WebSocket;
  role: ClientRole;
}

let clients: TaggedSocket[] = [];

/** Latest display state — cached so new controllers get current state on connect */
let lastDisplayState: string | null = null;
let lastSongData: string | null = null;
let lastBeatData: string | null = null;

export function attachWebSocket(server: Server): void {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (req, socket, head) => {
    if (req.url !== '/ws') {
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req);
    });
  });

  wss.on('connection', (ws, req) => {
    // Role from query: /ws?role=controller or /ws?role=display
    const url = new URL(req.url || '/', `http://${req.headers.host}`);
    const role = (url.searchParams.get('role') as ClientRole) || 'controller';

    const client: TaggedSocket = { ws, role };
    clients.push(client);
    console.log(`[ws] ${role} connected (${clients.length} clients)`);

    // Send cached state to new controllers
    if (role === 'controller') {
      if (lastDisplayState) ws.send(lastDisplayState);
      if (lastSongData) ws.send(lastSongData);
      if (lastBeatData) ws.send(lastBeatData);
    }

    ws.on('message', (raw) => {
      const msg = raw.toString();

      let parsed: { type?: string };
      try {
        parsed = JSON.parse(msg);
      } catch {
        return;
      }

      if (role === 'controller') {
        // Controller -> all displays
        for (const c of clients) {
          if (c.role === 'display' && c.ws.readyState === WebSocket.OPEN) {
            c.ws.send(msg);
          }
        }
      } else if (role === 'display') {
        // Display -> all controllers (state sync)
        if (parsed.type === 'state') lastDisplayState = msg;
        if (parsed.type === 'song') lastSongData = msg;
        if (parsed.type === 'beat') lastBeatData = msg;

        for (const c of clients) {
          if (c.role === 'controller' && c.ws.readyState === WebSocket.OPEN) {
            c.ws.send(msg);
          }
        }
      }
    });

    ws.on('close', () => {
      clients = clients.filter((c) => c.ws !== ws);
      console.log(`[ws] ${role} disconnected (${clients.length} clients)`);
    });
  });

  console.log('[ws] WebSocket relay attached');
}
