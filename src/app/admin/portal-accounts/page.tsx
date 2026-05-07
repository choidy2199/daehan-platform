"use client";
import { useEffect, useState } from "react";

type Grade = "in" | "out" | "pallet";
type Account = { login_id: string; is_active: boolean; auth_id: string | null };
type Item = {
  id: number;
  erp_code: string;
  name: string;
  dropship_enabled: boolean;
  dropship_price_grade: Grade | null;
  account: Account | null;
};

const GRADE_LABEL: Record<Grade, string> = { in: "IN", out: "OUT", pallet: "파렛" };

function getToken() {
  return localStorage.getItem("session_token") || sessionStorage.getItem("session_token") || "";
}
async function api(path: string, init?: RequestInit) {
  const r = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + getToken(),
      ...(init?.headers || {}),
    },
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d?.error || "요청 실패");
  return d;
}

export default function PortalAccountsPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [issueModal, setIssueModal] = useState<{ customer: Item; grade: Grade; loginId: string } | null>(null);
  const [credModal, setCredModal] = useState<{ login_id: string; temp_password: string } | null>(null);

  async function reload() {
    setLoading(true);
    setError("");
    try {
      const d = await api("/api/admin/portal-accounts?q=" + encodeURIComponent(q));
      setItems(d.items || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reload();
  }, []);

  function openIssue(c: Item) {
    setIssueModal({ customer: c, grade: c.dropship_price_grade || "out", loginId: c.erp_code || "" });
  }

  async function submitIssue() {
    if (!issueModal) return;
    try {
      const d = await api("/api/admin/portal-accounts", {
        method: "POST",
        body: JSON.stringify({
          customer_id: issueModal.customer.id,
          login_id: issueModal.loginId.trim(),
          dropship_price_grade: issueModal.grade,
        }),
      });
      setIssueModal(null);
      setCredModal({ login_id: d.login_id, temp_password: d.temp_password });
      reload();
    } catch (e: any) {
      alert(e.message);
    }
  }

  async function changeGrade(c: Item, g: Grade) {
    try {
      await api("/api/admin/portal-accounts/" + c.id, {
        method: "PUT",
        body: JSON.stringify({ dropship_price_grade: g }),
      });
      reload();
    } catch (e: any) {
      alert(e.message);
    }
  }

  async function toggleActive(c: Item) {
    if (!c.account) return;
    try {
      await api("/api/admin/portal-accounts/" + c.id, {
        method: "PUT",
        body: JSON.stringify({
          account_active: !c.account.is_active,
          dropship_enabled: !c.account.is_active,
        }),
      });
      reload();
    } catch (e: any) {
      alert(e.message);
    }
  }

  async function resetPassword(c: Item) {
    if (!c.account) return;
    if (!confirm(`${c.name} 의 임시 비밀번호를 새로 발급할까요?`)) return;
    try {
      const d = await api("/api/admin/portal-accounts/" + c.id + "/reset-password", { method: "POST" });
      setCredModal({ login_id: d.login_id, temp_password: d.temp_password });
    } catch (e: any) {
      alert(e.message);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={card}>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            type="text"
            placeholder="거래처명 또는 ERP 코드 검색"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && reload()}
            style={input}
          />
          <button onClick={reload} style={btnPrimary}>검색</button>
        </div>
        {error && <div style={errorBox}>{error}</div>}
      </div>

      <div style={{ ...card, padding: 0, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#1A1D23", color: "#fff" }}>
              <th style={th}>ERP 코드</th>
              <th style={th}>거래처명</th>
              <th style={th}>포털 계정</th>
              <th style={th}>활성</th>
              <th style={th}>단가등급</th>
              <th style={th}>액션</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={6} style={{ ...td, textAlign: "center", color: "#86868b" }}>불러오는 중...</td></tr>
            )}
            {!loading && items.length === 0 && (
              <tr><td colSpan={6} style={{ ...td, textAlign: "center", color: "#86868b" }}>결과 없음</td></tr>
            )}
            {items.map((c) => (
              <tr key={c.id} style={{ borderBottom: "1px solid #F0F0F0" }}>
                <td style={{ ...td, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 12 }}>{c.erp_code || "—"}</td>
                <td style={{ ...td, fontWeight: 600 }}>{c.name}</td>
                <td style={td}>
                  {c.account ? (
                    <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 12 }}>
                      {c.account.login_id}
                    </span>
                  ) : (
                    <span style={{ color: "#86868b" }}>—</span>
                  )}
                </td>
                <td style={td}>
                  {c.account ? (
                    <span
                      style={{
                        display: "inline-block",
                        padding: "2px 8px",
                        borderRadius: 4,
                        fontSize: 11,
                        fontWeight: 600,
                        background: c.account.is_active && c.dropship_enabled ? "#DCFCE7" : "#FEE2E2",
                        color: c.account.is_active && c.dropship_enabled ? "#166534" : "#991B1B",
                      }}
                    >
                      {c.account.is_active && c.dropship_enabled ? "활성" : "비활성"}
                    </span>
                  ) : (
                    <span style={{ color: "#86868b" }}>—</span>
                  )}
                </td>
                <td style={td}>
                  {c.account ? (
                    <select
                      value={c.dropship_price_grade || ""}
                      onChange={(e) => changeGrade(c, e.target.value as Grade)}
                      style={selectInput}
                    >
                      <option value="" disabled>선택</option>
                      {(["in", "out", "pallet"] as Grade[]).map((g) => (
                        <option key={g} value={g}>{GRADE_LABEL[g]}</option>
                      ))}
                    </select>
                  ) : (
                    <span style={{ color: "#86868b" }}>—</span>
                  )}
                </td>
                <td style={td}>
                  <div style={{ display: "flex", gap: 6 }}>
                    {c.account ? (
                      <>
                        <button onClick={() => toggleActive(c)} style={btnSecondary}>
                          {c.account.is_active && c.dropship_enabled ? "비활성화" : "활성화"}
                        </button>
                        <button onClick={() => resetPassword(c)} style={btnSecondary}>비번재발급</button>
                      </>
                    ) : (
                      <button onClick={() => openIssue(c)} style={btnPrimary}>계정 발급</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {issueModal && (
        <Modal onClose={() => setIssueModal(null)}>
          <h3 style={{ margin: 0, marginBottom: 12, fontSize: 16 }}>포털 계정 발급</h3>
          <div style={{ fontSize: 13, color: "#6e6e73", marginBottom: 12 }}>{issueModal.customer.name}</div>
          <label style={label}>로그인 ID</label>
          <input
            type="text"
            value={issueModal.loginId}
            onChange={(e) => setIssueModal({ ...issueModal, loginId: e.target.value })}
            style={input}
            placeholder="기본값: ERP 코드"
          />
          <label style={{ ...label, marginTop: 12 }}>단가등급</label>
          <div style={{ display: "flex", gap: 6 }}>
            {(["in", "out", "pallet"] as Grade[]).map((g) => (
              <button
                key={g}
                onClick={() => setIssueModal({ ...issueModal, grade: g })}
                style={{
                  ...btnSecondary,
                  background: issueModal.grade === g ? "#185FA5" : "#fff",
                  color: issueModal.grade === g ? "#fff" : "#1A1D23",
                  borderColor: issueModal.grade === g ? "#185FA5" : "#E5E7EB",
                }}
              >
                {GRADE_LABEL[g]}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 20 }}>
            <button onClick={() => setIssueModal(null)} style={btnSecondary}>취소</button>
            <button onClick={submitIssue} style={btnPrimary}>발급</button>
          </div>
        </Modal>
      )}

      {credModal && (
        <Modal onClose={() => setCredModal(null)}>
          <h3 style={{ margin: 0, marginBottom: 8, fontSize: 16 }}>임시 비밀번호 발급 완료</h3>
          <div style={{ fontSize: 12, color: "#991B1B", marginBottom: 12, fontWeight: 600 }}>
            ⚠ 이 비밀번호는 한 번만 표시됩니다. 거래처에 안전한 방법으로 전달하세요.
          </div>
          <div style={{ background: "#F4F6FA", padding: 12, borderRadius: 8, fontFamily: "ui-monospace, monospace", fontSize: 14 }}>
            <div>로그인 ID: <b>{credModal.login_id}</b></div>
            <div style={{ marginTop: 4 }}>임시 비번: <b>{credModal.temp_password}</b></div>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
            <button onClick={() => setCredModal(null)} style={btnPrimary}>확인</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff",
          borderRadius: 12,
          padding: 24,
          width: "100%",
          maxWidth: 420,
          boxShadow: "0 8px 24px rgba(0,0,0,0.16)",
        }}
      >
        {children}
      </div>
    </div>
  );
}

const card: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #E5E7EB",
  borderRadius: 12,
  padding: 16,
  boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
};
const th: React.CSSProperties = { padding: "10px 12px", textAlign: "left", fontSize: 12, fontWeight: 600 };
const td: React.CSSProperties = { padding: "10px 12px" };
const input: React.CSSProperties = {
  flex: 1,
  padding: "9px 12px",
  fontSize: 13,
  border: "1px solid #E5E7EB",
  borderRadius: 8,
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
};
const selectInput: React.CSSProperties = {
  padding: "5px 8px",
  fontSize: 12,
  border: "1px solid #E5E7EB",
  borderRadius: 6,
  background: "#fff",
};
const btnPrimary: React.CSSProperties = {
  background: "#185FA5",
  color: "#fff",
  border: "none",
  padding: "8px 14px",
  borderRadius: 8,
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
};
const btnSecondary: React.CSSProperties = {
  background: "#fff",
  color: "#1A1D23",
  border: "1px solid #E5E7EB",
  padding: "6px 12px",
  borderRadius: 6,
  fontSize: 12,
  fontWeight: 500,
  cursor: "pointer",
};
const label: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  color: "#6e6e73",
  marginBottom: 4,
  fontWeight: 500,
};
const errorBox: React.CSSProperties = {
  background: "#FEE2E2",
  color: "#991B1B",
  padding: "8px 12px",
  borderRadius: 6,
  fontSize: 12,
  marginTop: 8,
};
