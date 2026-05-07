"use client";
import { useEffect, useState } from "react";

type SessionUser = {
  id: number;
  name: string;
  loginId: string;
  role: string;
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [status, setStatus] = useState<"loading" | "ok" | "denied">("loading");

  useEffect(() => {
    const token =
      localStorage.getItem("session_token") ||
      sessionStorage.getItem("session_token");
    if (!token) {
      window.location.href = "/login?next=" + encodeURIComponent(window.location.pathname);
      return;
    }
    fetch("/api/auth/check", { headers: { Authorization: "Bearer " + token } })
      .then((r) => r.json().then((d) => ({ ok: r.ok, d })))
      .then(({ ok, d }) => {
        if (!ok || !d?.valid) {
          window.location.href = "/login";
          return;
        }
        const role = d.user?.role;
        const loginId = d.user?.loginId;
        const isStaff = loginId === "admin" || role === "admin" || role === "staff";
        if (!isStaff) {
          window.location.href = "/order";
          return;
        }
        setUser(d.user);
        setStatus("ok");
      })
      .catch(() => setStatus("denied"));
  }, []);

  function logout() {
    ["session_token", "session_refresh_token", "session_expires_at"].forEach((k) => {
      localStorage.removeItem(k);
      sessionStorage.removeItem(k);
    });
    localStorage.removeItem("current_user");
    window.location.href = "/login";
  }

  if (status === "loading") {
    return (
      <div style={center}>
        <span style={{ color: "#86868b", fontSize: 14 }}>확인 중...</span>
      </div>
    );
  }
  if (status === "denied" || !user) {
    return (
      <div style={center}>
        <span style={{ color: "#991B1B", fontSize: 14 }}>접근 권한이 없습니다.</span>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#F4F6FA", fontFamily: "'Pretendard Variable', Pretendard, -apple-system, sans-serif" }}>
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          background: "#1A1D23",
          color: "#fff",
          padding: "10px 16px",
          display: "flex",
          alignItems: "center",
          gap: 12,
          boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
        }}
      >
        <a href="/admin" style={{ color: "#fff", textDecoration: "none", fontSize: 15, fontWeight: 700 }}>
          주문접수 관리
        </a>
        <nav style={{ display: "flex", gap: 4, marginLeft: 8 }}>
          <a href="/admin/orders-receipt" style={navLink}>주문 관리</a>
          <a href="/admin/portal-accounts" style={navLink}>거래처 계정</a>
        </nav>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}>
          {user.name} · {user.role}
        </span>
        <button onClick={logout} style={logoutBtn}>로그아웃</button>
      </header>
      <main style={{ padding: 16, maxWidth: 1280, margin: "0 auto" }}>{children}</main>
    </div>
  );
}

const center: React.CSSProperties = {
  display: "flex",
  minHeight: "100vh",
  alignItems: "center",
  justifyContent: "center",
};
const navLink: React.CSSProperties = {
  color: "rgba(255,255,255,0.85)",
  textDecoration: "none",
  fontSize: 13,
  fontWeight: 500,
  padding: "6px 10px",
  borderRadius: 6,
};
const logoutBtn: React.CSSProperties = {
  background: "transparent",
  color: "rgba(255,255,255,0.85)",
  border: "1px solid rgba(255,255,255,0.25)",
  padding: "6px 12px",
  borderRadius: 6,
  fontSize: 12,
  cursor: "pointer",
};
