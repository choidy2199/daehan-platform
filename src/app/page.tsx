import Link from "next/link";

const menuCards = [
  {
    title: "밀워키 단가표",
    description: "밀워키 전체 제품 가격표 관리",
    href: "/catalog",
    badge: "밀워키",
    badgeColor: "badge-red",
    icon: "📋",
  },
  {
    title: "발주",
    description: "일반주문 · 프로모션 발주 관리",
    href: "/orders",
    badge: "밀워키",
    badgeColor: "badge-red",
    icon: "📦",
  },
  {
    title: "세트및분해",
    description: "배터리/충전기 시세 · 세트 분해 분석",
    href: "/setbun",
    badge: "밀워키",
    badgeColor: "badge-red",
    icon: "🔧",
  },
  {
    title: "일반제품 단가표",
    description: "밀워키 외 일반 제품 관리",
    href: "/general",
    badge: "일반",
    badgeColor: "badge-amber",
    icon: "📑",
  },
  {
    title: "검색 및 견적",
    description: "통합 검색 · 견적서 작성 · PDF 출력",
    href: "/estimate",
    badge: "견적",
    badgeColor: "badge-blue",
    icon: "🔍",
  },
  {
    title: "온라인판매 관리",
    description: "판매 관리 · 수수료 계산기",
    href: "/sales",
    badge: "판매",
    badgeColor: "badge-green",
    icon: "💰",
  },
  {
    title: "설정",
    description: "수수료 설정 · 거래처 등록",
    href: "/settings",
    badge: "관리",
    badgeColor: "badge-blue",
    icon: "⚙",
  },
];

export default function Home() {
  return (
    <>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--tl-text)" }}>
          관리 메뉴
        </h1>
        <p style={{ fontSize: 13, color: "var(--tl-text-secondary)", marginTop: 4 }}>
          관리할 항목을 선택하세요.
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
          gap: 16,
        }}
      >
        {menuCards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            style={{
              textDecoration: "none",
              color: "inherit",
              background: "var(--tl-bg)",
              border: "1px solid var(--tl-border)",
              borderRadius: 8,
              padding: "20px 18px",
              display: "flex",
              flexDirection: "column",
              gap: 10,
              transition: "all 0.2s",
            }}
            className="menu-card"
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 24 }}>{card.icon}</span>
              <span className={`badge ${card.badgeColor}`}>{card.badge}</span>
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 600 }}>{card.title}</div>
              <div style={{ fontSize: 12, color: "var(--tl-text-secondary)", marginTop: 2 }}>
                {card.description}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
