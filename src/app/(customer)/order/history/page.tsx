"use client";
import { useEffect, useState } from "react";

type Status = "waiting" | "confirmed" | "shipped" | "done" | "canceled";
type Item = {
  id: string;
  order_no: string;
  status: Status;
  ship_type: "normal" | "direct";
  total_amount: number;
  total_qty: number;
  ship_tracking_no: string | null;
  created_at: string;
  shipped_at: string | null;
  completed_at: string | null;
};

const STATUS_LABEL: Record<Status, string> = {
  waiting: "접수",
  confirmed: "확정",
  shipped: "출고",
  done: "완료",
  canceled: "취소",
};
const STATUS_COLOR: Record<Status, { bg: string; fg: string }> = {
  waiting: { bg: "#FEF3C7", fg: "#92400E" },
  confirmed: { bg: "#DBEAFE", fg: "#1E40AF" },
  shipped: { bg: "#E0E7FF", fg: "#4338CA" },
  done: { bg: "#DCFCE7", fg: "#166534" },
  canceled: { bg: "#FEE2E2", fg: "#991B1B" },
};

function getToken() {
  return localStorage.getItem("session_token") || sessionStorage.getItem("session_token") || "";
}
function fmt(n: number) {
  return Number(n || 0).toLocaleString("ko-KR");
}
function fmtDate(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" });
}

export default function HistoryPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/portal/orders", { headers: { Authorization: "Bearer " + getToken() } })
      .then((r) => r.json().then((d) => ({ ok: r.ok, d })))
      .then(({ ok, d }) => {
        if (!ok) throw new Error(d?.error || "조회 실패");
        setItems(d.items || []);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (error) return <div style={card}><div style={{ color: "#991B1B" }}>{error}</div></div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={card}>
        <h2 style={{ margin: 0, fontSize: 18 }}>내 주문 내역</h2>
      </div>
      <div style={{ ...card, padding: 0, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#1A1D23", color: "#fff" }}>
              <th style={th}>주문번호</th>
              <th style={th}>상태</th>
              <th style={th}>배송</th>
              <th style={{ ...th, textAlign: "right" }}>금액</th>
              <th style={th}>운송장</th>
              <th style={th}>접수일</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={6} style={{ ...td, textAlign: "center", color: "#86868b" }}>불러오는 중...</td></tr>}
            {!loading && items.length === 0 && (
              <tr><td colSpan={6} style={{ ...td, textAlign: "center", color: "#86868b" }}>주문 내역이 없습니다.</td></tr>
            )}
            {items.map((o) => (
              <tr key={o.id} style={{ borderBottom: "1px solid #F0F0F0" }}>
                <td style={{ ...td, fontFamily: "ui-monospace, monospace", fontSize: 12 }}>{o.order_no}</td>
                <td style={td}>
                  <span style={{
                    padding: "2px 8px",
                    borderRadius: 4,
                    fontSize: 11,
                    fontWeight: 600,
                    background: STATUS_COLOR[o.status].bg,
                    color: STATUS_COLOR[o.status].fg,
                  }}>{STATUS_LABEL[o.status]}</span>
                </td>
                <td style={td}>{o.ship_type === "direct" ? "직송" : "일반"}</td>
                <td style={{ ...td, textAlign: "right", fontWeight: 600 }}>{fmt(o.total_amount)}원</td>
                <td style={{ ...td, fontFamily: "ui-monospace, monospace", fontSize: 12 }}>{o.ship_tracking_no || "—"}</td>
                <td style={{ ...td, fontSize: 12, color: "#6e6e73" }}>{fmtDate(o.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const card: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #E5E7EB",
  borderRadius: 10,
  padding: 14,
  boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
};
const th: React.CSSProperties = { padding: "10px 12px", textAlign: "left", fontSize: 12, fontWeight: 600 };
const td: React.CSSProperties = { padding: "10px 12px" };
