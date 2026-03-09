interface BannerProps {
  message: string;
  variant?: "info" | "warning" | "error";
  onClose?: () => void;
}

export function Banner({ message, variant = "info", onClose }: BannerProps) {
  const colors = {
    info: { bg: "#e0f2fe", border: "#0284c7", text: "#0c4a6e" },
    warning: { bg: "#fef9c3", border: "#ca8a04", text: "#713f12" },
    error: { bg: "#fee2e2", border: "#dc2626", text: "#7f1d1d" },
  };

  const style = colors[variant];

  return (
    <div
      role="alert"
      style={{
        padding: "12px 16px",
        backgroundColor: style.bg,
        border: `1px solid ${style.border}`,
        borderRadius: "8px",
        color: style.text,
        fontFamily: "system-ui, sans-serif",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <p style={{ margin: 0 }}>{message}</p>
      {onClose && (
        <button
          onClick={onClose}
          aria-label="Close"
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            fontSize: "18px",
            color: style.text,
            padding: "4px 8px",
            lineHeight: 1,
          }}
        >
          ×
        </button>
      )}
    </div>
  );
}
