import { useStore } from '../store';

export default function ListeningPulse() {
  const isListening = useStore((s) => s.isListening);
  const isIdentifying = useStore((s) => s.isIdentifying);
  const audioFeatures = useStore((s) => s.audioFeatures);
  const accentColor = useStore((s) => s.accentColor);

  if (!isListening) return null;

  const scale = audioFeatures ? 1 + audioFeatures.rms * 2 : 1;

  return (
    <div className="relative flex items-center justify-center w-8 h-8">
      {/* Outer pulse ring */}
      <div
        className="absolute inset-0 rounded-full opacity-30 animate-ping"
        style={{
          backgroundColor: accentColor,
          animationDuration: isIdentifying ? '1s' : '2s',
        }}
      />
      {/* Inner dot */}
      <div
        className="relative w-3 h-3 rounded-full transition-transform duration-75"
        style={{
          backgroundColor: accentColor,
          transform: `scale(${scale})`,
        }}
      />
    </div>
  );
}
