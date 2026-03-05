interface Props {
  value: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
  label?: string;
}

export function ScoreRing({ value, size = 64, strokeWidth = 5, className = "", label }: Props) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - value * circumference;

  // Reconstruct hsl() strings from the raw CSS variables
  const strokeColor =
    value >= 0.8 ? "hsl(var(--c-ok))" : value >= 0.6 ? "hsl(var(--c-warn))" : "hsl(var(--c-err))";
  const dimColor =
    value >= 0.8
      ? "rgba(16, 185, 129, 0.15)"
      : value >= 0.6
        ? "rgba(245, 158, 11, 0.15)"
        : "rgba(239, 68, 68, 0.15)";

  return (
    <div className={`relative inline-flex items-center justify-center ${className}`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={dimColor}
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="score-ring"
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-sm font-bold text-txt-base" style={{ fontSize: size * 0.22 }}>
          {(value * 100).toFixed(0)}
        </span>
        {label && (
          <span className="text-txt-muted" style={{ fontSize: size * 0.13 }}>
            {label}
          </span>
        )}
      </div>
    </div>
  );
}
