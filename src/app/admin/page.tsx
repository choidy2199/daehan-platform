"use client";

const cards = [
  {
    href: "/admin/orders-receipt",
    title: "주문 관리",
    desc: "거래처 주문 접수/확정/출고/완료 워크플로우",
    color: "#185FA5",
  },
  {
    href: "/admin/portal-accounts",
    title: "거래처 계정",
    desc: "포털 계정 발급, 단가등급, 활성/비활성 관리",
    color: "#534AB7",
  },
];

export default function AdminIndexPage() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
      {cards.map((c) => (
        <a
          key={c.href}
          href={c.href}
          style={{
            background: "#fff",
            border: "1px solid #E5E7EB",
            borderRadius: 12,
            padding: 20,
            textDecoration: "none",
            color: "inherit",
            display: "block",
            boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
            transition: "transform 0.15s",
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 700, color: c.color, marginBottom: 6, letterSpacing: 0.5 }}>
            MENU
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#1A1D23" }}>{c.title}</div>
          <div style={{ fontSize: 13, color: "#6e6e73", marginTop: 6, lineHeight: 1.5 }}>{c.desc}</div>
        </a>
      ))}
    </div>
  );
}
