import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { findOrCreateUser, getUserById } from './users.js';

export function configurePassport(): void {
  const clientID = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientID || !clientSecret) {
    console.error('[auth] GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are required when REQUIRE_AUTH=true');
    process.exit(1);
  }

  // Determine callback URL: explicit env var, or infer from SITE_URL, or default
  const callbackURL =
    process.env.GOOGLE_CALLBACK_URL ||
    (process.env.SITE_URL
      ? `${process.env.SITE_URL}/api/auth/google/callback`
      : '/api/auth/google/callback');

  passport.use(
    new GoogleStrategy(
      {
        clientID,
        clientSecret,
        callbackURL,
        scope: ['profile', 'email'],
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          const user = await findOrCreateUser(profile);
          done(null, user);
        } catch (err) {
          done(err as Error);
        }
      },
    ),
  );

  passport.serializeUser((user, done) => {
    done(null, (user as { id: number }).id);
  });

  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await getUserById(id);
      done(null, user);
    } catch (err) {
      done(err);
    }
  });
}
