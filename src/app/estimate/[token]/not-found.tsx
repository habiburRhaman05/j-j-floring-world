export default function EstimateNotFound() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--paper)",
        padding: "24px 16px",
        textAlign: "center",
      }}
    >
      <img
        src="/jj-mascot.webp"
        alt="J&J Flooring World"
        style={{ width: 56, height: 56, borderRadius: 14, marginBottom: 16 }}
      />
      <h1 style={{ fontSize: 22, margin: "0 0 8px", color: "var(--ink)" }}>
        Estimate not available
      </h1>
      <p style={{ fontSize: 14, color: "var(--ink-2)", margin: 0, maxWidth: 360 }}>
        This estimate link is no longer available. If you believe this is an
        error, please contact J&amp;J Flooring World.
      </p>
    </div>
  );
}
