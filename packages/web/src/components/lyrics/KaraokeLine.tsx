interface KaraokeLineProps {
  text: string;
  isActive: boolean;
  isPast: boolean;
  isChorus: boolean;
  accentColor: string;
}

export default function KaraokeLine({
  text,
  isActive,
  isPast,
  isChorus,
  accentColor,
}: KaraokeLineProps) {
  return (
    <div
      className={`relative py-2 sm:py-3 transition-all duration-300 ${
        isActive
          ? isChorus
            ? 'text-xl sm:text-3xl md:text-5xl lg:text-6xl font-extrabold scale-105'
            : 'text-lg sm:text-2xl md:text-4xl lg:text-5xl font-bold scale-100'
          : isPast
          ? 'text-sm sm:text-base md:text-lg lg:text-2xl font-medium opacity-40 scale-95'
          : 'text-sm sm:text-base md:text-lg lg:text-2xl font-medium opacity-60 scale-95'
      }`}
    >
      {isActive ? (
        <span
          style={{
            color: accentColor,
            textShadow: isChorus
              ? `0 0 24px ${accentColor}aa, 0 0 48px ${accentColor}60, 0 0 80px ${accentColor}30`
              : `0 0 20px ${accentColor}80, 0 0 40px ${accentColor}40`,
          }}
        >
          {text}
        </span>
      ) : (
        <span className={isPast ? 'text-white/40' : 'text-white/70'}>{text}</span>
      )}
    </div>
  );
}
