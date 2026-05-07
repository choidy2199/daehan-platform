"use client";
import { useEffect, useMemo, useState } from "react";

type Grade = "in" | "out" | "pallet";
type CatalogItem = {
  code: string;
  name: string;
  brand: string;
  category: string;
  unit_price: number;
  min_qty: number;
  is_pallet_only: boolean;
  stock_label: "plenty" | "low" | "out";
};
type CatalogResp = { brands: string[]; grade: Grade; items: CatalogItem[] };
type Me = {
  customer: { id: number; erp_code: string; name: string; dropship_price_grade: Grade };
};

const GRADE_LABEL: Record<Grade, string> = { in: "IN단가", out: "OUT단가", pallet: "파렛단가" };
const STOCK_ICON: Record<CatalogItem["stock_label"], { emoji: string; text: string; color: string }> = {
  plenty: { emoji: "🟢", text: "여유", color: "#16A34A" },
  low: { emoji: "🟡", text: "소량", color: "#CA8A04" },
  out: { emoji: "🔴", text: "없음", color: "#DC2626" },
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

type CartItem = { code: string; name: string; brand: string; unit_price: number; quantity: number; min_qty: number };

export default function OrderPortalPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [resp, setResp] = useState<CatalogResp | null>(null);
  const [activeBrand, setActiveBrand] = useState<string>("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([api("/api/portal/me"), api("/api/portal/catalog")])
      .then(([meRes, catRes]) => {
        setMe(meRes);
        setResp(catRes);
        setActiveBrand(catRes.brands?.[0] || "");
      })
      .catch((e) => setError(e.message));
  }, []);

  const filteredItems = useMemo(() => {
    if (!resp) return [];
    if (!activeBrand) return resp.items;
    return resp.items.filter((p) => p.brand === activeBrand);
  }, [resp, activeBrand]);

  const cartTotal = useMemo(() => {
    let amt = 0, qty = 0;
    for (const c of cart) { amt += c.unit_price * c.quantity; qty += c.quantity; }
    return { amt, qty };
  }, [cart]);

  function addToCart(p: CatalogItem) {
    if (p.is_pallet_only) {
      alert("파렛 단가 제품입니다. 별도 문의 바랍니다.");
      return;
    }
    if (p.unit_price <= 0) {
      alert("단가가 설정되지 않은 제품입니다. 담당자에게 문의해주세요.");
      return;
    }
    setCart((prev) => {
      const ex = prev.find((c) => c.code === p.code);
      if (ex) return prev.map((c) => c.code === p.code ? { ...c, quantity: c.quantity + p.min_qty } : c);
      return [...prev, { code: p.code, name: p.name, brand: p.brand, unit_price: p.unit_price, quantity: p.min_qty, min_qty: p.min_qty }];
    });
  }
  function changeQty(code: string, qty: number) {
    setCart((prev) => prev.map((c) => c.code === code ? { ...c, quantity: Math.max(c.min_qty, qty) } : c));
  }
  function removeItem(code: string) {
    setCart((prev) => prev.filter((c) => c.code !== code));
  }

  async function submitOrder() {
    if (cart.length === 0) return;
    if (!confirm(`${cart.length}개 품목 / ${fmt(cartTotal.amt)}원 — 주문하시겠어요?`)) return;
    setSubmitting(true);
    try {
      const d = await api("/api/portal/orders", {
        method: "POST",
        body: JSON.stringify({
          ship_type: "normal",
          customer_note: note || undefined,
          items: cart.map((c) => ({ code: c.code, quantity: c.quantity })),
        }),
      });
      alert(`주문 접수 완료\n주문번호: ${d.order_no}`);
      setCart([]);
      setNote("");
      window.location.href = "/order/history";
    } catch (e: any) {
      alert("주문 실패: " + e.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (error) return <div style={card}><div style={{ color: "#991B1B" }}>{error}</div></div>;
  if (!me || !resp) return <div style={{ ...card, color: "#86868b" }}>불러오는 중...</div>;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 12 }}>
      <style>{`
        @media (max-width: 900px) {
          .order-grid { grid-template-columns: 1fr !important; }
          .order-cart { position: static !important; }
        }
        @media (max-width: 600px) {
          .catalog-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
      <div className="order-grid" style={{ display: "contents" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
          <div style={card}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span style={{ fontSize: 18, fontWeight: 700 }}>{me.customer.name}</span>
              <span style={gradeBadge}>{GRADE_LABEL[me.customer.dropship_price_grade]}</span>
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 12, flexWrap: "wrap" }}>
              {resp.brands.map((b) => (
                <button
                  key={b}
                  onClick={() => setActiveBrand(b)}
                  style={{
                    padding: "8px 14px",
                    borderRadius: 8,
                    border: `1px solid ${activeBrand === b ? "#185FA5" : "#E5E7EB"}`,
                    background: activeBrand === b ? "#185FA5" : "#fff",
                    color: activeBrand === b ? "#fff" : "#1A1D23",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >{b}</button>
              ))}
            </div>
          </div>

          <div className="catalog-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10 }}>
            {filteredItems.length === 0 && (
              <div style={{ ...card, gridColumn: "1 / -1", textAlign: "center", color: "#86868b" }}>
                해당 브랜드 제품이 없습니다.
              </div>
            )}
            {filteredItems.map((p) => {
              const stock = STOCK_ICON[p.stock_label];
              return (
                <div key={p.code} style={card}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 6 }}>
                    <span style={{ fontSize: 11, fontFamily: "ui-monospace, monospace", color: "#86868b" }}>{p.code}</span>
                    <span style={{ fontSize: 11, color: stock.color }}>{stock.emoji} {stock.text}</span>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 600, marginTop: 4, lineHeight: 1.3 }}>{p.name}</div>
                  <div style={{ fontSize: 11, color: "#6e6e73", marginTop: 2 }}>{p.category}</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: "#185FA5", marginTop: 8 }}>
                    {p.unit_price > 0 ? fmt(p.unit_price) + "원" : "—"}
                  </div>
                  {p.min_qty > 1 && (
                    <div style={{ fontSize: 11, color: "#6e6e73" }}>최소 {p.min_qty}개 단위</div>
                  )}
                  <button
                    onClick={() => addToCart(p)}
                    disabled={p.is_pallet_only || p.unit_price <= 0}
                    style={{
                      width: "100%",
                      marginTop: 10,
                      padding: "8px 0",
                      background: p.is_pallet_only || p.unit_price <= 0 ? "#E5E7EB" : "#185FA5",
                      color: "#fff",
                      border: "none",
                      borderRadius: 6,
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: p.is_pallet_only || p.unit_price <= 0 ? "not-allowed" : "pointer",
                    }}
                  >
                    {p.is_pallet_only ? "별도 문의" : "장바구니"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        <aside className="order-cart" style={{ ...card, position: "sticky", top: 64, alignSelf: "flex-start", maxHeight: "calc(100vh - 80px)", overflow: "auto" }}>
          <h3 style={{ margin: 0, marginBottom: 12, fontSize: 15 }}>장바구니 · {cart.length}건</h3>
          {cart.length === 0 ? (
            <div style={{ color: "#86868b", fontSize: 13, textAlign: "center", padding: "24px 0" }}>
              제품을 담아주세요
            </div>
          ) : (
            <>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {cart.map((c) => (
                  <div key={c.code} style={{ padding: 10, background: "#F4F6FA", borderRadius: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 12, fontWeight: 600 }}>{c.name}</span>
                      <button onClick={() => removeItem(c.code)} style={{ background: "none", border: "none", color: "#86868b", cursor: "pointer", fontSize: 16 }}>×</button>
                    </div>
                    <div style={{ fontSize: 11, color: "#6e6e73", fontFamily: "ui-monospace, monospace" }}>{c.code}</div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
                      <input
                        type="number"
                        min={c.min_qty}
                        step={c.min_qty}
                        value={c.quantity}
                        onChange={(e) => changeQty(c.code, parseInt(e.target.value) || c.min_qty)}
                        style={{ width: 80, padding: "4px 8px", fontSize: 13, border: "1px solid #E5E7EB", borderRadius: 6 }}
                      />
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{fmt(c.unit_price * c.quantity)}원</span>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 12 }}>
                <label style={{ fontSize: 11, color: "#6e6e73", display: "block", marginBottom: 4 }}>비고</label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  placeholder="배송 요청사항 등"
                  style={{ width: "100%", padding: 8, fontSize: 12, border: "1px solid #E5E7EB", borderRadius: 6, boxSizing: "border-box", resize: "vertical" }}
                />
              </div>
              <div style={{ marginTop: 12, display: "flex", justifyContent: "space-between", padding: "8px 0", borderTop: "1px solid #E5E7EB" }}>
                <span style={{ fontSize: 13, color: "#6e6e73" }}>총 {cartTotal.qty}개</span>
                <span style={{ fontSize: 18, fontWeight: 700 }}>{fmt(cartTotal.amt)}원</span>
              </div>
              <button
                onClick={submitOrder}
                disabled={submitting}
                style={{
                  width: "100%",
                  marginTop: 8,
                  padding: "12px 0",
                  background: submitting ? "#86868b" : "#185FA5",
                  color: "#fff",
                  border: "none",
                  borderRadius: 8,
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: submitting ? "not-allowed" : "pointer",
                }}
              >{submitting ? "처리 중..." : "주문하기"}</button>
            </>
          )}
        </aside>
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
const gradeBadge: React.CSSProperties = {
  background: "#185FA5",
  color: "#fff",
  fontSize: 11,
  fontWeight: 600,
  padding: "3px 8px",
  borderRadius: 4,
};
