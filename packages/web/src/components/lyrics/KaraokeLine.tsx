interface KaraokeLineProps {
  text: string;
  progress: number; // 0-1 how far through this line
  isActive: boolean;
  isPast: boolean;
  accentColor: string;
}

export default function KaraokeLine({
  text,
  progress,
  isActive,
  isPast,
  accentColor,
}: KaraokeLineProps) {
  return (
    <div
      className={`relative py-2 transition-all duration-300 ${
        isActive
          ? 'text-3xl md:text-4xl font-bold scale-100'
          : isPast
          ? 'text-xl md:text-2xl font-medium opacity-30 scale-95'
          : 'text-xl md:text-2xl font-medium opacity-40 scale-95'
      }`}
    >
      {isActive ? (
        <div className="relative inline-block">
          {/* Background text (unfilled) */}
          <span className="text-white/30">{text}</span>
          {/* Filled text overlay */}
          <span
            className="absolute inset-0 overflow-hidden whitespace-nowrap"
            style={{ width: `${progress * 100}%` }}
          >
            <span
              className="whitespace-nowrap"
              style={{ color: accentColor, textShadow: `0 0 30px ${accentColor}40` }}
            >
              {text}
            </span>
          </span>
        </div>
      ) : (
        <span className={isPast ? 'text-white/30' : 'text-white/40'}>{text}</span>
      )}
    </div>
  );
}
