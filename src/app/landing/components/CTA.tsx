"use client";

import Link from "next/link";

export function CTA() {
  return (
    <section
      style={{
        maxWidth: 1280,
        margin: "64px auto 80px",
        padding: "0 24px",
      }}
    >
      <div
        style={{
          borderRadius: 16,
          background: "var(--semantic-inverse-background)",
          padding: "64px 48px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 32,
          flexWrap: "wrap",
        }}
      >
        <div style={{ flex: "1 1 360px" }}>
          <h2
            style={{
              margin: 0,
              fontSize: "2rem",
              lineHeight: "2.75rem",
              letterSpacing: "-0.0253em",
              fontWeight: 700,
              color: "var(--semantic-inverse-label)",
            }}
          >
            지금 바로 시작하세요.
          </h2>
          <p
            style={{
              margin: "12px 0 0",
              maxWidth: 520,
              fontSize: "1rem",
              lineHeight: "1.5rem",
              letterSpacing: "0.0057em",
              color: "rgba(247,247,248,0.71)",
            }}
          >
            로그인 한 번으로 단가표 · 발주 · 수입 · 정산 전체 흐름을 사용할 수
            있습니다.
          </p>
        </div>
        <Link
          href="/login"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "12px 28px",
            fontSize: 16,
            lineHeight: 1.5,
            fontWeight: 600,
            letterSpacing: "0.0057em",
            borderRadius: 12,
            background: "var(--semantic-inverse-primary)",
            color: "#fff",
            textDecoration: "none",
            transition: "background .15s ease",
          }}
        >
          관리시스템 로그인 →
        </Link>
      </div>
    </section>
  );
}
