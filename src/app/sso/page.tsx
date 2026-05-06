"use client";
import { useEffect } from "react";

export default function SsoPage() {
  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, "");
    const params = new URLSearchParams(hash);
    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");
    const expiresIn = params.get("expires_in");

    if (!accessToken) {
      window.location.replace("/login");
      return;
    }

    fetch("/api/auth/check", {
      method: "GET",
      headers: { Authorization: "Bearer " + accessToken },
    })
      .then((r) => r.json().then((d) => ({ ok: r.ok, d })))
      .then(({ ok, d }) => {
        if (!ok || !d.valid) {
          window.location.replace("/login");
          return;
        }

        localStorage.setItem("session_token", accessToken);
        if (refreshToken) {
          localStorage.setItem("session_refresh_token", refreshToken);
        }
        if (expiresIn) {
          const expiresAt = Math.floor(Date.now() / 1000) + parseInt(expiresIn, 10);
          localStorage.setItem("session_expires_at", String(expiresAt));
        }
        localStorage.setItem("current_user", JSON.stringify(d.user));

        sessionStorage.removeItem("session_token");
        sessionStorage.removeItem("session_refresh_token");
        sessionStorage.removeItem("session_expires_at");

        window.location.replace("/manager/index.html");
      })
      .catch(() => {
        window.location.replace("/login");
      });
  }, []);

  return (
    <div
      style={{
        display: "flex",
        minHeight: "100vh",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "'Pretendard Variable', Pretendard, -apple-system, sans-serif",
        fontSize: 14,
        color: "#6e6e73",
      }}
    >
      로그인 처리 중...
    </div>
  );
}
