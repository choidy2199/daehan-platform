"use client";

import { useState } from "react";

type Feature = {
  title: string;
  description: string;
  tag: string;
  tagBg: string;
  tagFg: string;
  initial: string;
  bg: string;
};

const FEATURES: Feature[] = [
  {
    title: "밀워키 단가표",
    description:
      "27,000+ 제품의 원가·도매·소매·네이버·G마켓·SSG 단가를 한 화면에서. 마진과 마크업까지 실시간 계산.",
    tag: "Catalog",
    tagBg: "var(--atomic-blue-95)",
    tagFg: "var(--atomic-blue-40)",
    initial: "M",
    bg: "linear-gradient(135deg, #4F95FF, #0066FF)",
  },
  {
    title: "발주 자동화",
    description:
      "TTI 자동 발주, 누적·커머셜 프로모션, 매출 카드, 발주리스트 — 한 번의 클릭으로 처리.",
    tag: "Order",
    tagBg: "rgba(91,55,237,0.10)",
    tagFg: "var(--atomic-violet-45)",
    initial: "O",
    bg: "linear-gradient(135deg, #9E86FC, #5B37ED)",
  },
  {
    title: "인보이스V2",
    description:
      "수입 인보이스의 FOB·통관·VAT 배분을 클라이언트에서 즉시 검증. ±10원 단위 환차까지 추적.",
    tag: "Import",
    tagBg: "rgba(0,152,178,0.10)",
    tagFg: "var(--atomic-cyan-40)",
    initial: "I",
    bg: "linear-gradient(135deg, #28D0ED, #0098B2)",
  },
  {
    title: "백오더 관리",
    description:
      "입고 자동 감지, 거래처별 출고 처리, 부분 출고 추적. 대기·진행·완료 상태를 한눈에.",
    tag: "Backorder",
    tagBg: "rgba(255,146,0,0.10)",
    tagFg: "var(--atomic-orange-39)",
    initial: "B",
    bg: "linear-gradient(135deg, #FFA938, #D17600)",
  },
  {
    title: "공지사항 · 피드백",
    description:
      "Realtime 동기화 게시판, 댓글, 이미지 첨부, 오류 및 개선 요청을 한 곳에서.",
    tag: "Notice",
    tagBg: "rgba(232,70,205,0.10)",
    tagFg: "var(--atomic-pink-46)",
    initial: "N",
    bg: "linear-gradient(135deg, #FA73E3, #E846CD)",
  },
  {
    title: "판매 채널 정산",
    description:
      "네이버 커머스 · 쿠팡 · G마켓 · SSG의 수수료를 카테고리별로 산정. 정산 금액 자동 역산.",
    tag: "Settlement",
    tagBg: "rgba(0,150,50,0.10)",
    tagFg: "var(--atomic-green-40)",
    initial: "S",
    bg: "linear-gradient(135deg, #1ED45A, #009632)",
  },
];

function FeatureCard({ feature }: { feature: Feature }) {
  const [hover, setHover] = useState(false);
  return (
    <article
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        cursor: "pointer",
        borderRadius: 12,
        background: "var(--semantic-background-elevated)",
        overflow: "hidden",
        transition: "box-shadow .2s ease",
        boxShadow: hover
          ? "0 4px 6px -2px rgba(23,23,23,.07), 0 10px 15px -3px rgba(23,23,23,.07)"
          : "0 1px 2px -1px rgba(23,23,23,.06), inset 0 0 0 1px var(--semantic-line-alternative)",
      }}
    >
      <div
        style={{
          position: "relative",
          aspectRatio: "4 / 3",
          background: feature.bg,
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 80,
            color: "rgba(255,255,255,.95)",
            fontWeight: 800,
            letterSpacing: "-.04em",
          }}
        >
          {feature.initial}
        </div>
        <span
          style={{
            position: "absolute",
            top: 12,
            left: 12,
            padding: "4px 10px",
            borderRadius: 9999,
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: "0.0252em",
            background: "rgba(255,255,255,0.92)",
            color: "var(--semantic-label-neutral)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
          }}
        >
          {feature.tag}
        </span>
      </div>
      <div style={{ padding: 20 }}>
        <h3
          style={{
            margin: 0,
            fontSize: "1.25rem",
            lineHeight: "1.75rem",
            letterSpacing: "-0.012em",
            fontWeight: 700,
            color: "var(--semantic-label-normal)",
          }}
        >
          {feature.title}
        </h3>
        <p
          style={{
            margin: "8px 0 0",
            fontSize: 15,
            lineHeight: "22px",
            letterSpacing: "0.0096em",
            color: "var(--semantic-label-alternative)",
          }}
        >
          {feature.description}
        </p>
      </div>
    </article>
  );
}

export function FeatureCards() {
  return (
    <section
      id="features"
      style={{
        maxWidth: 1280,
        margin: "0 auto",
        padding: "64px 24px",
      }}
    >
      <div style={{ marginBottom: 40 }}>
        <h2
          style={{
            margin: 0,
            fontSize: "2.25rem",
            lineHeight: "3rem",
            letterSpacing: "-0.027em",
            fontWeight: 700,
            color: "var(--semantic-label-normal)",
          }}
        >
          모든 흐름이 한 화면에.
        </h2>
        <p
          style={{
            margin: "12px 0 0",
            maxWidth: 640,
            fontSize: "1.125rem",
            lineHeight: "1.625rem",
            letterSpacing: "-0.002em",
            color: "var(--semantic-label-alternative)",
          }}
        >
          매장 운영에 필요한 6개 핵심 메뉴.
        </p>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 24,
        }}
      >
        {FEATURES.map((f) => (
          <FeatureCard key={f.title} feature={f} />
        ))}
      </div>
    </section>
  );
}
