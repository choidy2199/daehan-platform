"use client";

import Link from "next/link";

export function Hero() {
  return (
    <section
      style={{
        maxWidth: 1280,
        margin: "0 auto",
        padding: "80px 24px 64px",
      }}
    >
      <p
        style={{
          fontSize: 14,
          lineHeight: "20px",
          letterSpacing: "0.0145em",
          fontWeight: 600,
          color: "var(--semantic-primary-normal)",
          margin: 0,
        }}
      >
        대한종합상사 · 통합 관리 플랫폼
      </p>
      <h1
        style={{
          margin: "16px 0 0",
          fontSize: "3.5rem",
          lineHeight: "4.5rem",
          letterSpacing: "-0.0319em",
          fontWeight: 700,
          color: "var(--semantic-label-normal)",
        }}
      >
        재고 · 발주 · 정산을
        <br />
        하나의 화면에서.
      </h1>
      <p
        style={{
          margin: "20px 0 0",
          maxWidth: 640,
          fontSize: "1.125rem",
          lineHeight: "1.625rem",
          letterSpacing: "-0.002em",
          color: "var(--semantic-label-alternative)",
        }}
      >
        밀워키 단가표부터 수입 인보이스V2, 발주 자동화, 백오더 추적까지 — 매장
        운영에 필요한 모든 흐름을 한 곳에서 처리합니다.
      </p>
      <div style={{ display: "flex", gap: 12, marginTop: 32 }}>
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
            background: "var(--semantic-primary-normal)",
            color: "#fff",
            textDecoration: "none",
            transition: "background .15s ease",
          }}
        >
          지금 로그인
        </Link>
        <a
          href="#features"
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
            background: "transparent",
            color: "var(--semantic-label-normal)",
            boxShadow: "inset 0 0 0 1px var(--semantic-line-neutral)",
            textDecoration: "none",
            transition: "background .15s ease",
          }}
        >
          기능 둘러보기
        </a>
      </div>

      <div
        style={{
          marginTop: 64,
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 24,
        }}
      >
        {[
          { label: "등록 제품", value: "12,840" },
          { label: "누적 발주", value: "3,240건" },
          { label: "처리 매입전표", value: "1,680건" },
          { label: "활성 사용자", value: "3명" },
        ].map((s) => (
          <div key={s.label}>
            <div
              style={{
                fontSize: "2rem",
                lineHeight: "2.75rem",
                letterSpacing: "-0.0253em",
                fontWeight: 700,
                color: "var(--semantic-label-normal)",
              }}
            >
              {s.value}
            </div>
            <div
              style={{
                marginTop: 4,
                fontSize: 13,
                lineHeight: "18px",
                letterSpacing: "0.0194em",
                color: "var(--semantic-label-alternative)",
                fontWeight: 500,
              }}
            >
              {s.label}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
