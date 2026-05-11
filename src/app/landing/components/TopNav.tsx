"use client";

import Link from "next/link";

const navLink: React.CSSProperties = {
  color: "var(--semantic-label-neutral)",
  cursor: "pointer",
  textDecoration: "none",
  letterSpacing: "0.0096em",
};

export function TopNav() {
  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 1100,
        background: "rgba(255,255,255,.92)",
        backdropFilter: "blur(32px)",
        WebkitBackdropFilter: "blur(32px)",
        boxShadow: "inset 0 -1px 0 rgba(112,115,124,.08)",
      }}
    >
      <div
        style={{
          maxWidth: 1280,
          margin: "0 auto",
          height: 60,
          padding: "0 24px",
          display: "flex",
          alignItems: "center",
          gap: 28,
        }}
      >
        <Link
          href="/landing"
          style={{
            background: "none",
            border: 0,
            padding: 0,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 10,
            textDecoration: "none",
          }}
        >
          <span
            style={{
              width: 28,
              height: 28,
              borderRadius: 7,
              background: "var(--semantic-primary-normal)",
              color: "#fff",
              fontWeight: 800,
              fontSize: 14,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            대
          </span>
          <span
            style={{
              fontSize: 20,
              fontWeight: 700,
              letterSpacing: "-.02em",
              color: "var(--semantic-label-normal)",
            }}
          >
            대한종합상사
          </span>
        </Link>
        <nav
          style={{
            display: "flex",
            gap: 22,
            fontSize: 15,
            fontWeight: 500,
            color: "var(--semantic-label-neutral)",
          }}
        >
          <a style={navLink}>단가표</a>
          <a style={navLink}>발주</a>
          <a style={navLink}>수입</a>
          <a style={navLink}>판매관리</a>
          <a style={navLink}>공지사항</a>
        </nav>
        <div style={{ flex: 1 }} />
        <Link
          href="/login"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "9px 20px",
            fontSize: 15,
            lineHeight: 1.466,
            fontWeight: 600,
            letterSpacing: "0.0096em",
            borderRadius: 10,
            background: "var(--semantic-primary-normal)",
            color: "#fff",
            textDecoration: "none",
            transition: "background .15s ease",
          }}
        >
          로그인
        </Link>
      </div>
    </header>
  );
}
