import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

interface QRPairingProps {
  sessionId: string;
}

export default function QRPairing({ sessionId }: QRPairingProps) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    const remoteUrl = `${window.location.origin}/remote?session=${sessionId}`;
    QRCode.toDataURL(remoteUrl, {
      width: 160,
      margin: 1,
      color: { dark: '#ffffffdd', light: '#00000000' },
    }).then(setDataUrl).catch(() => {});
  }, [sessionId]);

  if (!dataUrl) return null;

  return (
    <div className="flex flex-col items-center gap-1.5">
      <img src={dataUrl} alt="Scan to connect remote" width={120} height={120} className="rounded-lg" />
      <p className="text-[11px] text-white/50 text-center leading-snug max-w-[160px]">
        Scan to look up<br />music videos &amp; lyrics
      </p>
    </div>
  );
}
