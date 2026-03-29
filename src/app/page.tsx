import Link from "next/link";

const menuCards = [
  {
    title: "품목관리",
    description: "밀워키 제품 및 일반 제품 관리",
    href: "/products",
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    ),
  },
  {
    title: "거래처관리",
    description: "고객사 및 거래처 정보 관리",
    href: "/clients",
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    title: "주문관리",
    description: "발주 및 주문 내역 관리",
    href: "/orders",
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
      </svg>
    ),
  },
  {
    title: "가격관리",
    description: "제품 가격 및 프로모션 관리",
    href: "/pricing",
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="bg-[#185FA5] shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <span className="text-white text-xl font-bold tracking-tight">
                대한종합상사
              </span>
              <span className="text-blue-200 text-sm hidden sm:inline">
                관리시스템
              </span>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-10">
          <h1 className="text-2xl font-bold text-gray-900">관리 메뉴</h1>
          <p className="mt-2 text-gray-600">
            관리할 항목을 선택하세요.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {menuCards.map((card) => (
            <Link
              key={card.href}
              href={card.href}
              className="group bg-white rounded-xl border border-gray-200 p-6 shadow-sm hover:shadow-md hover:border-[#185FA5] transition-all duration-200"
            >
              <div className="flex flex-col items-start gap-4">
                <div className="p-3 rounded-lg bg-blue-50 text-[#185FA5] group-hover:bg-[#185FA5] group-hover:text-white transition-colors duration-200">
                  {card.icon}
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 group-hover:text-[#185FA5] transition-colors">
                    {card.title}
                  </h2>
                  <p className="mt-1 text-sm text-gray-500">
                    {card.description}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
