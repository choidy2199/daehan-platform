export function Footer() {
  return (
    <footer
      style={{
        padding: "32px 24px",
        borderTop: "1px solid var(--semantic-line-neutral)",
        color: "var(--semantic-label-alternative)",
        fontSize: 13,
        letterSpacing: "0.0194em",
      }}
    >
      <div
        style={{
          maxWidth: 1280,
          margin: "0 auto",
          display: "flex",
          flexWrap: "wrap",
          gap: 16,
          justifyContent: "space-between",
        }}
      >
        <span>© 대한종합상사 · daehantool.dev</span>
        <span>Montage WDS · Phase 1 preview</span>
      </div>
    </footer>
  );
}
