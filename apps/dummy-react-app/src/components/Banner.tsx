interface BannerProps {
  message: string;
  variant?: "info" | "warning" | "error";
}

export function Banner({ message, variant = "info" }: BannerProps) {
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
      }}
    >
      <p style={{ margin: 0 }}>{message}</p>
    </div>
  );
}
