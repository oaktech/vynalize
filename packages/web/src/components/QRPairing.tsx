import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

interface QRPairingProps {
  sessionId: string;
}

export default function QRPairing({ sessionId }: QRPairingProps) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function generate() {
      let origin = window.location.origin;

      // localhost URLs aren't reachable from a phone — swap in the LAN IP
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
        width: 160,
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
    <div className="flex flex-col items-center gap-1.5">
      <img src={dataUrl} alt="Scan to connect remote" width={120} height={120} className="rounded-lg" />
      <p className="text-sm text-white/50 text-center leading-snug max-w-[180px]">
        Scan or visit<br /><span className="text-white/70">vynalize.com/remote</span><br />and enter the code
      </p>
    </div>
  );
}
