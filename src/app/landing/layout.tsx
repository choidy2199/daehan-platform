import type { Metadata } from "next";
import "./montage.css";

export const metadata: Metadata = {
  title: "대한종합상사 — 통합 관리시스템",
  description: "재고·발주·정산을 하나의 화면에서. 대한종합상사 통합 관리 플랫폼.",
};

export default function LandingLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div data-montage data-theme="light" style={{ minHeight: "100vh" }}>
      {children}
    </div>
  );
}
