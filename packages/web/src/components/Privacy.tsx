export default function Privacy() {
  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <a href="/" className="text-white/30 text-sm hover:text-white/60 transition-colors">
          &larr; Back
        </a>

        <h1 className="text-2xl font-bold mt-4 mb-8">Privacy Policy</h1>

        <div className="space-y-6 text-white/60 text-sm leading-relaxed">
          <p className="text-white/40 text-xs">Last updated: February 18, 2026</p>

          <section>
            <h2 className="text-white text-base font-semibold mb-2">What We Collect</h2>
            <p>
              When a song is identified, we record the <strong className="text-white/80">song title, artist,
              album name, and album art URL</strong>. We also derive an <strong className="text-white/80">approximate
              geographic location</strong> (city, region, and country) from your IP address using a local
              database lookup.
            </p>
          </section>

          <section>
            <h2 className="text-white text-base font-semibold mb-2">What We Do NOT Collect</h2>
            <ul className="list-disc list-inside space-y-1 text-white/50">
              <li>IP addresses — used only for geolocation, never stored</li>
              <li>Cookies or tracking identifiers</li>
              <li>Personal information (names, emails, accounts)</li>
              <li>Session or device identifiers</li>
              <li>Audio recordings — audio is processed in real-time and immediately discarded</li>
            </ul>
          </section>

          <section>
            <h2 className="text-white text-base font-semibold mb-2">How We Use the Data</h2>
            <p>
              Song play data is used solely to generate an <strong className="text-white/80">aggregate
              leaderboard</strong> showing which songs are most popular. Individual plays cannot be
              traced back to any person or device.
            </p>
          </section>

          <section>
            <h2 className="text-white text-base font-semibold mb-2">Third-Party Services</h2>
            <p>
              We use <strong className="text-white/80">Shazam</strong> (via an open-source library) for
              song identification. Audio samples are sent to Shazam's servers for matching and are not
              retained. No other third-party analytics or tracking services are used.
            </p>
          </section>

          <section>
            <h2 className="text-white text-base font-semibold mb-2">Geolocation</h2>
            <p>
              Geographic location is determined server-side using a bundled IP geolocation database
              (MaxMind GeoLite2). Your IP address is <strong className="text-white/80">never stored</strong> —
              only the resulting city, region, and country are saved. No external geolocation API calls
              are made.
            </p>
          </section>

          <section>
            <h2 className="text-white text-base font-semibold mb-2">Data Retention</h2>
            <p>
              Song play records are retained indefinitely to maintain the historical leaderboard.
              Since no personal data is collected, there is no personally identifiable information
              to delete.
            </p>
          </section>

          <section>
            <h2 className="text-white text-base font-semibold mb-2">Contact</h2>
            <p>
              Questions about this policy? Open an issue on the{' '}
              <a
                href="https://github.com/oaktech/vynalize"
                className="text-white/80 underline hover:text-white transition-colors"
                target="_blank"
                rel="noopener noreferrer"
              >
                Vynalize GitHub repository
              </a>.
            </p>
          </section>
        </div>

        <div className="mt-12 text-center">
          <a href="/leaderboard" className="text-white/20 text-xs hover:text-white/40 transition-colors">
            Leaderboard
          </a>
        </div>
      </div>
    </div>
  );
}
