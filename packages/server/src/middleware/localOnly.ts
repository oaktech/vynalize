import type { Request, Response, NextFunction } from 'express';
import { networkInterfaces } from 'os';

/**
 * Middleware that restricts access to requests from the local machine
 * or private (LAN) IP addresses. Used to protect admin-only routes
 * like /api/settings and /api/diag.
 */

const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

function isPrivateIP(ip: string): boolean {
  // Strip IPv6-mapped IPv4 prefix
  const addr = ip.startsWith('::ffff:') ? ip.slice(7) : ip;

  if (LOOPBACK.has(ip)) return true;

  // IPv4 private ranges
  const parts = addr.split('.').map(Number);
  if (parts.length === 4) {
    // 10.0.0.0/8
    if (parts[0] === 10) return true;
    // 172.16.0.0/12
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    // 192.168.0.0/16
    if (parts[0] === 192 && parts[1] === 168) return true;
    // 169.254.0.0/16 (link-local)
    if (parts[0] === 169 && parts[1] === 254) return true;
  }

  // IPv6 link-local (fe80::/10) and unique local (fc00::/7)
  const lower = addr.toLowerCase();
  if (lower.startsWith('fe80:') || lower.startsWith('fc') || lower.startsWith('fd')) {
    return true;
  }

  return false;
}

// Cache the set of local IPs on this machine (refreshed per-request would be wasteful)
let localIPs: Set<string> | null = null;
function getLocalIPs(): Set<string> {
  if (localIPs) return localIPs;
  localIPs = new Set<string>(LOOPBACK);
  const ifaces = networkInterfaces();
  for (const addrs of Object.values(ifaces)) {
    if (!addrs) continue;
    for (const a of addrs) {
      localIPs.add(a.address);
    }
  }
  // Refresh every 60s in case network changes
  setTimeout(() => { localIPs = null; }, 60_000);
  return localIPs;
}

export { isPrivateIP };

export function localOnly(req: Request, res: Response, next: NextFunction): void {
  // Use the raw TCP peer address — NOT req.ip, which reflects X-Forwarded-For
  // when trust proxy is enabled and can be spoofed by any remote client.
  const ip = req.socket.remoteAddress ?? '';

  if (isPrivateIP(ip) || getLocalIPs().has(ip)) {
    next();
    return;
  }

  res.status(403).json({ error: 'This endpoint is only accessible from the local network' });
}
