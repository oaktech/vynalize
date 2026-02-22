import type { Request, Response, NextFunction } from 'express';

const requireAuth = process.env.REQUIRE_AUTH === 'true';

/**
 * Blocks unauthenticated requests when REQUIRE_AUTH=true.
 * No-op when auth is disabled (self-hosted/Pi mode).
 */
export function authRequired(req: Request, res: Response, next: NextFunction): void {
  if (!requireAuth) return next();
  if (req.isAuthenticated?.()) return next();
  res.status(401).json({ error: 'Authentication required' });
}

/**
 * Returns the authenticated user's ID, or null if not logged in / auth disabled.
 */
export function getUserId(req: Request): number | null {
  if (!requireAuth) return null;
  const user = req.user as { id: number } | undefined;
  return user?.id ?? null;
}

export function isAuthEnabled(): boolean {
  return requireAuth;
}
