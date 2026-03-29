"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavItem {
  label: string;
  href: string;
}

interface NavSector {
  name: string;
  sectorClass: string;
  labelClass: string;
  items: NavItem[];
}

const navSectors: NavSector[] = [
  {
    name: "밀워키",
    sectorClass: "nav-sector-milwaukee",
    labelClass: "label-milwaukee",
    items: [
      { label: "단가표", href: "/catalog" },
      { label: "발주", href: "/orders" },
      { label: "세트및분해", href: "/setbun" },
    ],
  },
  {
    name: "일반",
    sectorClass: "nav-sector-general",
    labelClass: "label-general",
    items: [
      { label: "일반제품 단가표", href: "/general" },
    ],
  },
  {
    name: "견적",
    sectorClass: "nav-sector-estimate",
    labelClass: "label-estimate",
    items: [
      { label: "검색 및 견적", href: "/estimate" },
    ],
  },
  {
    name: "판매",
    sectorClass: "nav-sector-sales",
    labelClass: "label-sales",
    items: [
      { label: "온라인판매 관리", href: "/sales" },
    ],
  },
  {
    name: "설정",
    sectorClass: "nav-sector-manage",
    labelClass: "label-manage",
    items: [
      { label: "설정", href: "/settings" },
    ],
  },
];

export default function Navigation() {
  const pathname = usePathname();

  return (
    <nav className="top-nav">
      <Link href="/" className="nav-logo" style={{ textDecoration: "none" }}>
        (주)대한종합상사
      </Link>
      <div className="nav-tabs">
        {navSectors.map((sector, sIdx) => (
          <div key={sector.name} style={{ display: "flex", alignItems: "center" }}>
            {sIdx > 0 && <div className="nav-divider" />}
            <div className={`nav-sector ${sector.sectorClass}`}>
              <span className={`nav-sector-label ${sector.labelClass}`}>
                {sector.name}
              </span>
              {sector.items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`nav-tab ${pathname === item.href ? "active" : ""}`}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </nav>
  );
}
