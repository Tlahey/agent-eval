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
  const color =
    value >= 0.8
      ? "var(--color-success)"
      : value >= 0.6
        ? "var(--color-warning)"
        : "var(--color-danger)";
  const bgColor =
    value >= 0.8
      ? "var(--color-success-dim)"
      : value >= 0.6
        ? "var(--color-warning-dim)"
        : "var(--color-danger-dim)";

  return (
    <div className={`relative inline-flex items-center justify-center ${className}`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={bgColor}
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
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
