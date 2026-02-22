import { Router } from 'express';
import passport from 'passport';

export const authRouter = Router();

// Initiate Google OAuth
authRouter.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

// Handle OAuth callback
authRouter.get(
  '/google/callback',
  passport.authenticate('google', { failureRedirect: '/?auth=failed' }),
  (_req, res) => {
    res.redirect('/');
  },
);

// Return current user info
authRouter.get('/me', (req, res) => {
  if (!req.isAuthenticated?.()) {
    res.json({ authenticated: false });
    return;
  }

  const user = req.user as {
    id: number;
    email: string;
    display_name: string;
    avatar_url: string | null;
    has_youtube_api_key: boolean;
  };

  res.json({
    authenticated: true,
    user: {
      id: user.id,
      email: user.email,
      displayName: user.display_name,
      avatarUrl: user.avatar_url,
      hasYoutubeApiKey: user.has_youtube_api_key,
    },
  });
});

// Logout
authRouter.post('/logout', (req, res) => {
  req.logout((err) => {
    if (err) {
      console.error('[auth] Logout error:', err);
      res.status(500).json({ error: 'Logout failed' });
      return;
    }
    req.session?.destroy((destroyErr) => {
      if (destroyErr) console.error('[auth] Session destroy error:', destroyErr);
      res.clearCookie('connect.sid');
      res.json({ ok: true });
    });
  });
});
