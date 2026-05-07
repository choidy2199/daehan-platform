"use client";
import { useEffect, useState } from "react";

type Status = "waiting" | "confirmed" | "shipped" | "done" | "canceled";
type ShipType = "normal" | "direct";

type ListItem = {
  id: string;
  order_no: string;
  customer_id: number;
  customer_code: string;
  customer_name: string;
  status: Status;
  ship_type: ShipType;
  price_grade: "in" | "out" | "pallet";
  total_amount: number;
  total_qty: number;
  ship_tracking_no: string | null;
  created_at: string;
};

type OrderItem = {
  id: string;
  line_no: number;
  product_code: string;
  product_name: string;
  brand: string;
  category: string | null;
  unit_price: number;
  quantity: number;
  amount: number;
  stock_at_order: string | null;
  note: string | null;
};

type OrderDetail = ListItem & {
  ship_recipient_name: string | null;
  ship_recipient_phone: string | null;
  ship_zip: string | null;
  ship_addr1: string | null;
  ship_addr2: string | null;
  ship_addr_verified: boolean;
  ship_note: string | null;
  ship_carrier: string | null;
  customer_note: string | null;
  internal_note: string | null;
  shipped_at: string | null;
  completed_at: string | null;
  canceled_at: string | null;
};

const STATUS_LABEL: Record<Status, string> = {
  waiting: "대기",
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

function fmt(n: number) {
  return Number(n || 0).toLocaleString("ko-KR");
}
function fmtDate(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" });
}

export default function OrdersReceiptPage() {
  const [items, setItems] = useState<ListItem[]>([]);
  const [kpi, setKpi] = useState({ waiting: 0, confirmed: 0, shipped: 0, done: 0, canceled: 0 });
  const [filterStatus, setFilterStatus] = useState<Status | "">("");
  const [filterShip, setFilterShip] = useState<ShipType | "">("");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<{ order: OrderDetail; items: OrderItem[] } | null>(null);
  const [loading, setLoading] = useState(false);

  async function reload() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterStatus) params.set("status", filterStatus);
      if (filterShip) params.set("shipType", filterShip);
      if (q) params.set("q", q);
      const d = await api("/api/admin/orders-receipt?" + params.toString());
      setItems(d.items || []);
      setKpi(d.kpi || kpi);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function openDetail(id: string) {
    try {
      const d = await api("/api/admin/orders-receipt/" + id);
      setSelected({ order: d.order, items: d.items });
    } catch (e: any) {
      alert(e.message);
    }
  }

  async function transition(action: "confirm" | "ship" | "complete" | "cancel", extra: any = {}) {
    if (!selected) return;
    try {
      await api("/api/admin/orders-receipt/" + selected.order.id + "/transition", {
        method: "POST",
        body: JSON.stringify({ action, ...extra }),
      });
      await openDetail(selected.order.id);
      reload();
    } catch (e: any) {
      alert(e.message);
    }
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterStatus, filterShip]);

  return (
    <div style={{ display: "grid", gridTemplateColumns: selected ? "1fr 460px" : "1fr", gap: 12 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
        {/* KPI 카드 4개 */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
          {(["waiting", "confirmed", "shipped", "done"] as Status[]).map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(filterStatus === s ? "" : s)}
              style={{
                background: filterStatus === s ? STATUS_COLOR[s].bg : "#fff",
                border: `1px solid ${filterStatus === s ? STATUS_COLOR[s].fg : "#E5E7EB"}`,
                borderRadius: 10,
                padding: "12px 16px",
                cursor: "pointer",
                textAlign: "left",
                color: filterStatus === s ? STATUS_COLOR[s].fg : "#1A1D23",
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 600 }}>{STATUS_LABEL[s]}</div>
              <div style={{ fontSize: 22, fontWeight: 700, marginTop: 2 }}>{kpi[s]}</div>
            </button>
          ))}
        </div>

        {/* 필터 */}
        <div style={card}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <select value={filterShip} onChange={(e) => setFilterShip(e.target.value as any)} style={selectInput}>
              <option value="">전체 배송</option>
              <option value="normal">일반</option>
              <option value="direct">직송</option>
            </select>
            <input
              type="text"
              placeholder="주문번호/거래처명 검색"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && reload()}
              style={{ ...input, maxWidth: 240 }}
            />
            <button onClick={reload} style={btnPrimary}>검색</button>
          </div>
        </div>

        {/* 목록 */}
        <div style={{ ...card, padding: 0, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#1A1D23", color: "#fff" }}>
                <th style={th}>주문번호</th>
                <th style={th}>거래처</th>
                <th style={th}>상태</th>
                <th style={th}>배송</th>
                <th style={{ ...th, textAlign: "right" }}>금액</th>
                <th style={th}>접수</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={6} style={{ ...td, textAlign: "center", color: "#86868b" }}>불러오는 중...</td></tr>}
              {!loading && items.length === 0 && (
                <tr><td colSpan={6} style={{ ...td, textAlign: "center", color: "#86868b" }}>주문이 없습니다</td></tr>
              )}
              {items.map((o) => (
                <tr
                  key={o.id}
                  onClick={() => openDetail(o.id)}
                  style={{
                    borderBottom: "1px solid #F0F0F0",
                    cursor: "pointer",
                    background: selected?.order.id === o.id ? "#EFF6FF" : "transparent",
                  }}
                >
                  <td style={{ ...td, fontFamily: "ui-monospace, monospace", fontSize: 12 }}>{o.order_no}</td>
                  <td style={{ ...td, fontWeight: 600 }}>{o.customer_name}</td>
                  <td style={td}>
                    <span style={{
                      display: "inline-block",
                      padding: "2px 8px",
                      borderRadius: 4,
                      fontSize: 11,
                      fontWeight: 600,
                      background: STATUS_COLOR[o.status].bg,
                      color: STATUS_COLOR[o.status].fg,
                    }}>{STATUS_LABEL[o.status]}</span>
                  </td>
                  <td style={td}>{o.ship_type === "direct" ? "직송" : "일반"}</td>
                  <td style={{ ...td, textAlign: "right" }}>{fmt(o.total_amount)}원</td>
                  <td style={{ ...td, fontSize: 12, color: "#6e6e73" }}>{fmtDate(o.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 우측 상세 패널 */}
      {selected && (
        <aside style={{ ...card, position: "sticky", top: 64, alignSelf: "flex-start", maxHeight: "calc(100vh - 80px)", overflow: "auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <h3 style={{ margin: 0, fontSize: 15 }}>{selected.order.order_no}</h3>
            <button onClick={() => setSelected(null)} style={{ ...btnSecondary, padding: "4px 10px" }}>닫기</button>
          </div>
          <div style={{ fontSize: 13, color: "#6e6e73" }}>{selected.order.customer_name} · {selected.order.customer_code}</div>
          <div style={{ display: "flex", gap: 6, marginTop: 8, alignItems: "center" }}>
            <span style={{
              padding: "2px 8px",
              borderRadius: 4,
              fontSize: 11,
              fontWeight: 600,
              background: STATUS_COLOR[selected.order.status].bg,
              color: STATUS_COLOR[selected.order.status].fg,
            }}>{STATUS_LABEL[selected.order.status]}</span>
            <span style={{ fontSize: 11, padding: "2px 6px", background: "#F4F6FA", borderRadius: 4 }}>
              {selected.order.ship_type === "direct" ? "직송" : "일반"}
            </span>
            <span style={{ fontSize: 11, padding: "2px 6px", background: "#F4F6FA", borderRadius: 4 }}>
              {selected.order.price_grade.toUpperCase()}
            </span>
          </div>

          {selected.order.ship_type === "direct" && (
            <div style={{ marginTop: 12, padding: 12, background: "#FFF7ED", borderRadius: 8, fontSize: 12 }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>📦 직송 정보</div>
              <div>받는분: {selected.order.ship_recipient_name || "—"} ({selected.order.ship_recipient_phone || "—"})</div>
              <div style={{ marginTop: 2 }}>주소: ({selected.order.ship_zip || "—"}) {selected.order.ship_addr1 || "—"} {selected.order.ship_addr2 || ""}</div>
              {selected.order.ship_note && <div style={{ marginTop: 2 }}>요청: {selected.order.ship_note}</div>}
            </div>
          )}

          <div style={{ marginTop: 12, fontSize: 12, fontWeight: 600, color: "#6e6e73" }}>품목</div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, marginTop: 6 }}>
            <thead>
              <tr style={{ background: "#F4F6FA" }}>
                <th style={{ ...th, padding: "6px 8px", color: "#6e6e73" }}>제품</th>
                <th style={{ ...th, padding: "6px 8px", color: "#6e6e73", textAlign: "right" }}>단가</th>
                <th style={{ ...th, padding: "6px 8px", color: "#6e6e73", textAlign: "right" }}>수량</th>
                <th style={{ ...th, padding: "6px 8px", color: "#6e6e73", textAlign: "right" }}>금액</th>
              </tr>
            </thead>
            <tbody>
              {selected.items.map((it) => (
                <tr key={it.id} style={{ borderBottom: "1px solid #F0F0F0" }}>
                  <td style={{ padding: "6px 8px" }}>
                    <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 11, color: "#6e6e73" }}>{it.product_code}</div>
                    <div>{it.product_name}</div>
                  </td>
                  <td style={{ padding: "6px 8px", textAlign: "right" }}>{fmt(it.unit_price)}</td>
                  <td style={{ padding: "6px 8px", textAlign: "right" }}>{it.quantity}</td>
                  <td style={{ padding: "6px 8px", textAlign: "right", fontWeight: 600 }}>{fmt(it.amount)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3} style={{ padding: "8px", textAlign: "right", fontWeight: 600 }}>합계</td>
                <td style={{ padding: "8px", textAlign: "right", fontWeight: 700, fontSize: 14 }}>
                  {fmt(selected.order.total_amount)}원
                </td>
              </tr>
            </tfoot>
          </table>

          {selected.order.customer_note && (
            <div style={{ marginTop: 12, fontSize: 12 }}>
              <div style={{ color: "#6e6e73", marginBottom: 4 }}>거래처 비고</div>
              <div style={{ padding: 8, background: "#F4F6FA", borderRadius: 6 }}>{selected.order.customer_note}</div>
            </div>
          )}

          {/* 액션 바 */}
          <div style={{ display: "flex", gap: 6, marginTop: 16, flexWrap: "wrap" }}>
            {selected.order.status === "waiting" && (
              <>
                <button onClick={() => transition("confirm")} style={btnPrimary}>확정</button>
                <button onClick={() => { if (confirm("주문을 거절하시겠습니까?")) transition("cancel"); }} style={btnDanger}>거절</button>
              </>
            )}
            {selected.order.status === "confirmed" && (
              <>
                <ShipForm onSubmit={(carrier, trackingNo) => transition("ship", { ship_carrier: carrier, ship_tracking_no: trackingNo })} required={selected.order.ship_type === "direct"} />
                <button onClick={() => { if (confirm("주문을 거절하시겠습니까?")) transition("cancel"); }} style={btnDanger}>거절</button>
              </>
            )}
            {selected.order.status === "shipped" && (
              <button onClick={() => transition("complete")} style={btnPrimary}>완료 처리</button>
            )}
          </div>
        </aside>
      )}
    </div>
  );
}

function ShipForm({ onSubmit, required }: { onSubmit: (carrier: string, trackingNo: string) => void; required: boolean }) {
  const [carrier, setCarrier] = useState("");
  const [trackingNo, setTrackingNo] = useState("");
  return (
    <div style={{ width: "100%", display: "flex", gap: 6, flexWrap: "wrap" }}>
      <input type="text" placeholder="택배사" value={carrier} onChange={(e) => setCarrier(e.target.value)} style={{ ...input, flex: "1 1 120px" }} />
      <input type="text" placeholder={required ? "운송장번호 (직송 필수)" : "운송장번호"} value={trackingNo} onChange={(e) => setTrackingNo(e.target.value)} style={{ ...input, flex: "1 1 160px" }} />
      <button
        onClick={() => {
          if (required && !trackingNo.trim()) {
            alert("직송 출고는 운송장 번호 필수입니다.");
            return;
          }
          onSubmit(carrier.trim(), trackingNo.trim());
        }}
        style={btnPrimary}
      >출고처리</button>
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
  padding: "9px 12px",
  fontSize: 13,
  border: "1px solid #E5E7EB",
  borderRadius: 8,
  outline: "none",
  boxSizing: "border-box",
};
const selectInput: React.CSSProperties = {
  padding: "9px 12px",
  fontSize: 13,
  border: "1px solid #E5E7EB",
  borderRadius: 8,
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
  padding: "8px 14px",
  borderRadius: 8,
  fontSize: 13,
  fontWeight: 500,
  cursor: "pointer",
};
const btnDanger: React.CSSProperties = {
  background: "#fff",
  color: "#DC2626",
  border: "1px solid #FCA5A5",
  padding: "8px 14px",
  borderRadius: 8,
  fontSize: 13,
  fontWeight: 500,
  cursor: "pointer",
};
