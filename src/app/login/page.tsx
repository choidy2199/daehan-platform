"use client";
import { useState, useEffect } from "react";

export default function LoginPage() {
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [saveLogin, setSaveLogin] = useState(false);
  const [keepLogin, setKeepLogin] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // 저장된 로그인 정보 복원
  useEffect(() => {
    const saved = localStorage.getItem("save_login_checked");
    if (saved === "true") {
      setSaveLogin(true);
      setLoginId(localStorage.getItem("saved_login_id") || "");
      setPassword(localStorage.getItem("saved_login_pw") || "");
    }
    const keep = localStorage.getItem("keep_login_checked");
    if (keep === "true") setKeepLogin(true);

    // 이미 로그인된 상태면 관리시스템으로 이동
    const token = localStorage.getItem("session_token") || sessionStorage.getItem("session_token");
    if (token) {
      fetch("/api/auth/check", {
        method: "GET",
        headers: { "Authorization": "Bearer " + token },
      })
        .then((r) => r.json().then((d) => ({ ok: r.ok, d })))
        .then(({ ok, d }) => {
          if (ok && d.valid) {
            window.location.href = "/";
          } else {
            // 토큰 무효 → 정리
            localStorage.removeItem("session_token");
            localStorage.removeItem("session_refresh_token");
            localStorage.removeItem("session_expires_at");
            sessionStorage.removeItem("session_token");
            sessionStorage.removeItem("session_refresh_token");
            sessionStorage.removeItem("session_expires_at");
            localStorage.removeItem("current_user");
          }
        })
        .catch(() => { /* 네트워크 오류 시 그대로 로그인 화면 유지 */ });
    }
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const resp = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ loginId, password, keepLogin }),
      });
      const data = await resp.json();

      if (!resp.ok) {
        setError(data.error || "로그인 실패");
        setLoading(false);
        return;
      }

      // 아이디/비밀번호 저장
      if (saveLogin) {
        localStorage.setItem("saved_login_id", loginId);
        localStorage.setItem("saved_login_pw", password);
        localStorage.setItem("save_login_checked", "true");
      } else {
        localStorage.removeItem("saved_login_id");
        localStorage.removeItem("saved_login_pw");
        localStorage.setItem("save_login_checked", "false");
      }
      localStorage.setItem("keep_login_checked", keepLogin ? "true" : "false");

      // Supabase JWT 저장 (app.js와 호환을 위해 키 이름 유지)
      const storage = keepLogin ? localStorage : sessionStorage;
      storage.setItem("session_token", data.token);
      // refresh_token, expires_at도 저장 (app.js Step 4-3에서 갱신 시 사용)
      if (data.refresh_token) {
        storage.setItem("session_refresh_token", data.refresh_token);
      }
      if (data.expires_at) {
        storage.setItem("session_expires_at", String(data.expires_at));
      }
      // 다른 storage에 잔존 가능한 옛 토큰 정리 (keepLogin 토글 시 양쪽 공존 방지)
      const otherStorage = keepLogin ? sessionStorage : localStorage;
      otherStorage.removeItem("session_token");
      otherStorage.removeItem("session_refresh_token");
      otherStorage.removeItem("session_expires_at");

      // 사용자 정보 저장
      localStorage.setItem("current_user", JSON.stringify(data.user));

      window.location.href = "/";
    } catch (err: any) {
      setError("서버 연결 오류");
      setLoading(false);
    }
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh", fontFamily: "'Pretendard Variable', Pretendard, -apple-system, sans-serif" }}>
      {/* 좌측 다크 패널 */}
      <div
        style={{
          width: "38%",
          background: "linear-gradient(160deg, #1A1D23 0%, #2c2f36 100%)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
        }}
        className="login-left"
      >
        <img
          src="/manager/daehanrogo.png"
          alt="대한종합상사"
          style={{ width: 120, height: "auto", opacity: 0.9 }}
        />
        <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 11, letterSpacing: 3, fontWeight: 500 }}>
          DAEHAN TOOL
        </span>
      </div>

      {/* 우측 로그인 폼 */}
      <div
        style={{
          flex: 1,
          background: "linear-gradient(180deg, #fff 0%, #fafafa 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "40px 20px",
        }}
      >
        <form onSubmit={handleLogin} style={{ width: "100%", maxWidth: 360 }}>
          <h1 style={{ fontSize: 22, fontWeight: 500, color: "#1d1d1f", marginBottom: 6 }}>
            로그인
          </h1>
          <p style={{ fontSize: 13, color: "#86868b", marginBottom: 28 }}>
            아이디와 비밀번호를 입력하세요
          </p>

          <input
            type="text"
            placeholder="아이디"
            value={loginId}
            onChange={(e) => setLoginId(e.target.value)}
            style={{
              width: "100%",
              padding: "12px 16px",
              fontSize: 14,
              border: "1px solid #e2e2e7",
              borderRadius: 10,
              outline: "none",
              marginBottom: 10,
              boxSizing: "border-box",
              background: "#fff",
            }}
            autoFocus
          />
          <input
            type="password"
            placeholder="비밀번호"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{
              width: "100%",
              padding: "12px 16px",
              fontSize: 14,
              border: "1px solid #e2e2e7",
              borderRadius: 10,
              outline: "none",
              marginBottom: 14,
              boxSizing: "border-box",
              background: "#fff",
            }}
          />

          {/* 체크박스 행 */}
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#6e6e73", cursor: "pointer" }}>
              <input type="checkbox" checked={saveLogin} onChange={(e) => setSaveLogin(e.target.checked)} style={{ accentColor: "#1d1d1f" }} />
              아이디/비밀번호 저장
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#6e6e73", cursor: "pointer" }}>
              <input type="checkbox" checked={keepLogin} onChange={(e) => setKeepLogin(e.target.checked)} style={{ accentColor: "#1d1d1f" }} />
              로그인 유지
            </label>
          </div>

          {error && (
            <div style={{ background: "#FEE2E2", color: "#991B1B", padding: "10px 14px", borderRadius: 8, fontSize: 13, marginBottom: 14, fontWeight: 500 }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding: "13px 0",
              background: loading ? "#86868b" : "#1d1d1f",
              color: "#fff",
              border: "none",
              borderRadius: 10,
              fontSize: 15,
              fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer",
              transition: "background 0.2s",
            }}
          >
            {loading ? "로그인 중..." : "로그인"}
          </button>
        </form>
      </div>

      {/* 모바일 반응형 CSS */}
      <style>{`
        @media (max-width: 768px) {
          .login-left { display: none !important; }
        }
      `}</style>
    </div>
  );
}
