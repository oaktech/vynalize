export default function Privacy() {
  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <a href="/" className="text-white/30 text-sm hover:text-white/60 transition-colors">
          &larr; Back
        </a>

        <h1 className="text-2xl font-bold mt-4 mb-8">Privacy Policy</h1>

        <div className="space-y-6 text-white/60 text-sm leading-relaxed">
          <p className="text-white/40 text-xs">Last updated: February 19, 2026</p>

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
              <li>Audio recordings — samples are used only for identification and immediately discarded (see below)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-white text-base font-semibold mb-2">Microphone &amp; Audio</h2>
            <p>
              Vynalize requests microphone access to identify songs and drive visualizations. Every 20 seconds,
              a <strong className="text-white/80">5-second audio sample</strong> is captured in-browser, sent to
              the Vynalize server over your local network, and forwarded to Shazam for song matching. The sample
              is <strong className="text-white/80">deleted immediately</strong> after identification completes — it
              is never stored on our server or written to disk permanently. Audio frequency data used for
              visualizations is analyzed entirely in-browser and never leaves your device.
            </p>
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
            <h2 className="text-white text-base font-semibold mb-2">Local Storage</h2>
            <p>
              Your browser's <strong className="text-white/80">localStorage</strong> is used to save UI
              preferences (visualizer mode, accent color, sensitivity), your selected audio input device, and
              a history of the last 50 identified songs. This data never leaves your browser and can be cleared
              at any time through your browser settings.
            </p>
          </section>

          <section>
            <h2 className="text-white text-base font-semibold mb-2">Third-Party Services</h2>
            <p className="mb-2">
              We do not use any third-party analytics or tracking services. The following external
              services are contacted to provide core functionality:
            </p>
            <ul className="list-disc list-inside space-y-1.5 text-white/50">
              <li><strong className="text-white/70">Shazam</strong> — receives short audio samples for song identification; samples are not retained</li>
              <li><strong className="text-white/70">YouTube API</strong> — receives song title and artist to search for music videos</li>
              <li><strong className="text-white/70">MusicBrainz</strong> — receives song title and artist to look up album and release metadata</li>
              <li><strong className="text-white/70">Cover Art Archive</strong> — receives album release IDs (not personal data) to fetch artwork</li>
              <li><strong className="text-white/70">lrclib.net</strong> — receives song title and artist to fetch synchronized lyrics</li>
            </ul>
            <p className="mt-2">
              In all cases, only song metadata (title and artist) is sent — no personal or device information
              is included in these requests.
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
