export default function LoginPage() {
  return (
    <div className="w-screen h-screen flex items-center justify-center bg-black">
      <div className="text-center max-w-md px-6">
        <img
          src="/vynalize-logo.png"
          alt="Vynalize"
          className="w-full max-w-96 mx-auto mb-8"
        />
        <p className="text-white/40 text-sm mb-8 leading-relaxed">
          Sign in to start using Vynalize — real-time visualizations,
          lyrics, and music videos driven by what's playing.
        </p>

        <a
          href="/api/auth/google"
          className="inline-flex items-center gap-3 px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-2xl transition-all duration-300 text-white/80 hover:text-white"
        >
          <svg width="20" height="20" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          Sign in with Google
        </a>

        <p className="text-white/20 text-xs mt-6">
          We only use your Google profile to identify your account.
          <br />
          <a href="/privacy" className="underline hover:text-white/40 transition-colors">Privacy Policy</a>
        </p>
      </div>
    </div>
  );
}
