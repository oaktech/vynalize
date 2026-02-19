import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { useStore } from '../store';

/** Full-screen centered QR prompt shown on content screens when no remote is connected */
export default function QRPrompt() {
  const sessionId = useStore((s) => s.sessionId);
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;

    async function generate() {
      let origin = window.location.origin;

      const host = window.location.hostname;
      if (host === 'localhost' || host === '127.0.0.1') {
        try {
          const res = await fetch('/api/config');
          const cfg = await res.json();
          if (cfg.lanHost) {
            origin = `${window.location.protocol}//${cfg.lanHost}:${window.location.port}`;
          }
        } catch { /* fall through to localhost URL */ }
      }

      if (cancelled) return;
      const remoteUrl = `${origin}/remote?session=${sessionId}`;
      const url = await QRCode.toDataURL(remoteUrl, {
        width: 320,
        margin: 1,
        color: { dark: '#ffffffdd', light: '#00000000' },
      });
      if (!cancelled) setDataUrl(url);
    }

    generate();
    return () => { cancelled = true; };
  }, [sessionId]);

  if (!dataUrl) return null;

  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-6">
      <img src={dataUrl} alt="Scan to connect remote" width={200} height={200} className="rounded-xl" />
      <p className="text-xl font-semibold text-white/70 text-center leading-snug max-w-xs">
        Scan here to look up<br />lyrics &amp; music videos
      </p>
    </div>
  );
}
