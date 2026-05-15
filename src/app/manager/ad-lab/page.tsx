'use client';

import { Fragment, useEffect, useState, CSSProperties, ReactNode } from 'react';

// ─── 디자인 토큰 ─────────────────────────────────────────
const C = {
  bg: '#F4F6FA',
  surface: '#FFFFFF',
  text: '#1A1D23',
  textSec: '#5A6070',
  textHint: '#9BA3B2',
  border: '#DDE1EB',
  borderRow: '#F0F2F7',
  primary: '#185FA5',
  primaryLight: '#E6F1FB',
  primaryDark: '#0C447C',
  dark: '#1A1D23',
  thBg: '#EAECF2',
  success: '#1D9E75',
  successBg: '#E1F5EE',
  warning: '#EF9F27',
  warningBg: '#FAEEDA',
  danger: '#CC2222',
  dangerBg: '#FCEBEB',
};

const FONT = "'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

const BADGE_COLOR: Record<BadgeTone, { bg: string; fg: string }> = {
  blue: { bg: '#E6F1FB', fg: '#0C447C' },
  green: { bg: '#E1F5EE', fg: '#085041' },
  amber: { bg: '#FAEEDA', fg: '#412402' },
  red: { bg: '#FCEBEB', fg: '#791F1F' },
  gray: { bg: '#F1EFE8', fg: '#2C2C2A' },
};
type BadgeTone = 'blue' | 'green' | 'amber' | 'red' | 'gray';

// ─── 메인 ─────────────────────────────────────────────
type SubTab = 'budget' | 'keyword' | 'dashboard' | 'log' | 'setting';
const SUB_TABS: { id: SubTab; label: string }[] = [
  { id: 'budget', label: '예산 설정' },
  { id: 'keyword', label: '키워드 관리' },
  { id: 'dashboard', label: '대시보드' },
  { id: 'log', label: '실행 로그' },
  { id: 'setting', label: '설정' },
];

export default function AdLabPage() {
  const [activeTab, setActiveTab] = useState<SubTab>('budget');

  useEffect(() => {
    if (document.getElementById('ad-lab-pretendard')) return;
    const link = document.createElement('link');
    link.id = 'ad-lab-pretendard';
    link.rel = 'stylesheet';
    link.href =
      'https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css';
    document.head.appendChild(link);
  }, []);

  return (
    <div
      style={{
        minHeight: '100vh',
        background: C.bg,
        fontFamily: FONT,
        color: C.text,
        fontFeatureSettings: "'tnum' 1",
      }}
    >
      <style>{`.content { width: 100% !important; }`}</style>
      <SubTabBar active={activeTab} onChange={setActiveTab} />
      <div style={{ width: '100%' }}>
        {activeTab === 'budget' && <BudgetTab />}
        {activeTab === 'keyword' && <KeywordTab />}
        {activeTab === 'dashboard' && <DashboardTab />}
        {activeTab === 'log' && <LogTab />}
        {activeTab === 'setting' && <SettingTab />}
      </div>
    </div>
  );
}

// ─── 서브탭 바 ─────────────────────────────────────────
function SubTabBar({
  active,
  onChange,
}: {
  active: SubTab;
  onChange: (v: SubTab) => void;
}) {
  return (
    <div
      style={{
        background: C.surface,
        borderBottom: `1px solid ${C.border}`,
        display: 'flex',
        padding: '0 24px',
      }}
    >
      {SUB_TABS.map((tab) => {
        const isActive = active === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            style={{
              background: 'transparent',
              border: 'none',
              padding: '12px 16px',
              fontSize: 13,
              fontWeight: isActive ? 600 : 500,
              color: isActive ? C.primary : C.textSec,
              cursor: 'pointer',
              borderBottom: `2px solid ${isActive ? C.primary : 'transparent'}`,
              fontFamily: 'inherit',
            }}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

// ─── 공통 컴포넌트 ─────────────────────────────────────
function PageTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16,
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: C.text }}>{children}</h1>
      {right}
    </div>
  );
}

function HelpBox({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        background: C.primaryLight,
        borderRadius: 6,
        padding: '10px 14px',
        marginBottom: 16,
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      <span
        style={{
          width: 18,
          height: 18,
          borderRadius: '50%',
          background: C.primary,
          color: '#fff',
          fontSize: 11,
          fontWeight: 700,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          marginTop: 1,
        }}
      >
        i
      </span>
      <span style={{ fontSize: 13, lineHeight: 1.55, color: C.primaryDark }}>{children}</span>
    </div>
  );
}

function Tooltip({ label, children }: { label: string; children?: ReactNode }) {
  return (
    <span style={{ position: 'relative', display: 'inline-block' }} className="adl-tip">
      <span
        style={{
          width: 14,
          height: 14,
          borderRadius: '50%',
          background: C.primary,
          color: '#fff',
          fontSize: 9,
          fontWeight: 700,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginLeft: 4,
          cursor: 'help',
          verticalAlign: 'middle',
        }}
      >
        ?
      </span>
      <span
        className="adl-tip-bubble"
        style={{
          position: 'absolute',
          bottom: 'calc(100% + 6px)',
          left: '50%',
          transform: 'translateX(-50%)',
          background: C.dark,
          color: '#fff',
          fontSize: 11,
          fontWeight: 500,
          padding: '6px 10px',
          borderRadius: 4,
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
          opacity: 0,
          transition: 'opacity 120ms ease',
          zIndex: 100,
          boxShadow: '0 4px 12px rgba(26,29,35,0.18)',
        }}
      >
        {children ?? label}
      </span>
      <style>{`.adl-tip:hover .adl-tip-bubble { opacity: 1 !important; }`}</style>
    </span>
  );
}

function Section({
  title,
  right,
  sub,
  children,
}: {
  title: string;
  right?: ReactNode;
  sub?: string;
  children: ReactNode;
}) {
  return (
    <div
      style={{
        marginBottom: 20,
        width: '100%',
        minWidth: '100%',
        maxWidth: '100%',
        display: 'block',
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          background: C.dark,
          color: '#fff',
          height: 40,
          padding: '0 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderRadius: '6px 6px 0 0',
          width: '100%',
          boxSizing: 'border-box',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <span style={{ fontSize: 15, fontWeight: 600 }}>{title}</span>
          {sub && (
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>{sub}</span>
          )}
        </div>
        {right}
      </div>
      <div
        style={{
          background: C.surface,
          border: `1px solid ${C.border}`,
          borderTop: 'none',
          borderRadius: '0 0 6px 6px',
          padding: 16,
          width: '100%',
          boxSizing: 'border-box',
        }}
      >
        {children}
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  sub,
  variant = 'light',
  tooltip,
}: {
  label: string;
  value: string;
  sub?: string;
  variant?: 'main' | 'light';
  tooltip?: string;
}) {
  const isMain = variant === 'main';
  return (
    <div
      style={{
        background: isMain ? C.primary : C.primaryLight,
        color: isMain ? '#fff' : C.primaryDark,
        borderRadius: 8,
        padding: '14px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      }}
    >
      <div
        style={{
          fontSize: 12,
          fontWeight: 500,
          color: isMain ? 'rgba(255,255,255,0.8)' : C.textSec,
          display: 'flex',
          alignItems: 'center',
        }}
      >
        {label}
        {tooltip && <Tooltip label={tooltip} />}
      </div>
      <div
        style={{
          fontSize: isMain ? 28 : 24,
          fontWeight: 700,
          color: isMain ? '#fff' : C.primary,
          letterSpacing: '-0.01em',
        }}
      >
        {value}
      </div>
      {sub && (
        <div
          style={{
            fontSize: 11,
            color: isMain ? 'rgba(255,255,255,0.7)' : C.textSec,
          }}
        >
          {sub}
        </div>
      )}
    </div>
  );
}

function Badge({ tone = 'gray', children }: { tone?: BadgeTone; children: ReactNode }) {
  const c = BADGE_COLOR[tone];
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 8px',
        background: c.bg,
        color: c.fg,
        fontSize: 11,
        fontWeight: 600,
        borderRadius: 4,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  );
}

function Btn({
  variant = 'primary',
  onClick,
  children,
}: {
  variant?: 'primary' | 'secondary' | 'danger';
  onClick?: () => void;
  children: ReactNode;
}) {
  const styles: Record<string, CSSProperties> = {
    primary: { background: C.primary, color: '#fff', border: 'none' },
    secondary: {
      background: 'transparent',
      color: C.primary,
      border: `1px solid ${C.primary}`,
    },
    danger: { background: C.danger, color: '#fff', border: 'none' },
  };
  return (
    <button
      onClick={onClick}
      style={{
        ...styles[variant],
        borderRadius: 6,
        padding: '8px 16px',
        fontSize: 13,
        fontWeight: 600,
        fontFamily: 'inherit',
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  );
}

function Toggle({ on }: { on: boolean }) {
  return (
    <span
      style={{
        display: 'inline-block',
        width: 36,
        height: 20,
        borderRadius: 10,
        background: on ? C.primary : '#C9CCD4',
        position: 'relative',
        verticalAlign: 'middle',
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 2,
          left: on ? 18 : 2,
          width: 16,
          height: 16,
          borderRadius: '50%',
          background: '#fff',
          transition: 'left 120ms ease',
        }}
      />
    </span>
  );
}

// ─── 공용 테이블 셀 스타일 ───────────────────────────
const TH: CSSProperties = {
  background: C.thBg,
  color: C.textSec,
  fontSize: 12,
  fontWeight: 600,
  textAlign: 'center',
  padding: '8px 12px',
  borderBottom: `1px solid ${C.border}`,
};
const TD: CSSProperties = {
  fontSize: 13,
  color: C.text,
  textAlign: 'center',
  padding: '8px 12px',
  borderBottom: `1px solid ${C.borderRow}`,
};

// ═════════════════════════════════════════════════════════════
//  탭 1 — 예산 설정
// ═════════════════════════════════════════════════════════════
function BudgetTab() {
  const products = [
    {
      on: true,
      name: '밀워키 M18 임팩트렌치 2967',
      price: 580000,
      margin: 18,
      adRatio: 6.0,
      dailyMax: 12000,
      cpcMax: 350,
      minRoas: 320,
    },
    {
      on: true,
      name: '밀워키 M18 충전드릴 2903',
      price: 410000,
      margin: 22,
      adRatio: 7.5,
      dailyMax: 9000,
      cpcMax: 280,
      minRoas: 380,
    },
    {
      on: true,
      name: '밀워키 M18 배터리 5.0Ah',
      price: 198000,
      margin: 28,
      adRatio: 9.0,
      dailyMax: 6500,
      cpcMax: 220,
      minRoas: 410,
    },
    {
      on: false,
      name: '디월트 임팩트드라이버 DCF887',
      price: 320000,
      margin: 14,
      adRatio: 4.5,
      dailyMax: 5000,
      cpcMax: 180,
      minRoas: 250,
    },
  ];

  const grades: {
    grade: string;
    tone: BadgeTone;
    roas: string;
    budget: string;
    bid: string;
    note: string;
  }[] = [
    {
      grade: 'S등급',
      tone: 'green',
      roas: '500% 이상',
      budget: '예산 +30%',
      bid: '입찰가 +15%',
      note: '🚀 잘 팔리는 효자 — 광고비 더 태우자',
    },
    {
      grade: 'A등급',
      tone: 'blue',
      roas: '300~499%',
      budget: '예산 +10%',
      bid: '입찰가 +5%',
      note: '👍 안정적 — 조금씩 키운다',
    },
    {
      grade: 'B등급',
      tone: 'gray',
      roas: '200~299%',
      budget: '예산 유지',
      bid: '입찰가 유지',
      note: '⚖️ 본전 — 그대로 둔다',
    },
    {
      grade: 'C등급',
      tone: 'amber',
      roas: '100~199%',
      budget: '예산 −20%',
      bid: '입찰가 −10%',
      note: '⚠️ 손해 직전 — 조심한다',
    },
    {
      grade: 'D등급',
      tone: 'red',
      roas: '99% 이하',
      budget: '예산 −50%',
      bid: '광고 일시정지',
      note: '🛑 돈 새는 중 — 멈춘다',
    },
  ];

  return (
    <div style={{ width: '100%' }}>
      <PageTitle>예산 설정</PageTitle>
      <HelpBox>
        <strong>예산 설정이란?</strong> 각 제품마다 광고비를 얼마까지 쓸 건지 정하는 화면입니다.
        AD-LAB은 여기서 정한 한도 안에서만 자동으로 입찰가를 올리거나 내립니다.
      </HelpBox>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: 12,
          marginBottom: 20,
          width: '100%',
        }}
      >
        <KpiCard
          variant="main"
          label="월 총 광고 예산"
          value="₩500,000"
          sub="이번 달 사용 가능한 최대 금액"
        />
        <KpiCard
          label="이번 달 사용"
          value="₩127,400"
          sub="전체 예산의 25% 사용"
        />
        <KpiCard
          label="평균 광고 수익률"
          value="387%"
          sub="1만원 써서 3.87만원 수익"
          tooltip="ROAS = 광고비 대비 매출"
        />
      </div>

      <Section title="제품별 광고비 설정">
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <thead>
            <tr>
              <th style={{ ...TH, width: 60 }}>광고</th>
              <th style={{ ...TH, textAlign: 'left' }}>제품명</th>
              <th style={{ ...TH, width: 100 }}>판매가</th>
              <th style={{ ...TH, width: 80 }}>마진율</th>
              <th style={{ ...TH, width: 100 }}>
                광고비 비율
                <Tooltip label="판매가의 몇 %까지 광고에 쓸지" />
              </th>
              <th style={{ ...TH, width: 110 }}>일 최대 광고비</th>
              <th style={{ ...TH, width: 100 }}>
                클릭당 최대
                <Tooltip label="CPC — 클릭 한 번에 쓸 수 있는 최대 금액" />
              </th>
              <th style={{ ...TH, width: 100 }}>
                최소 수익률
                <Tooltip label="이 수익률 밑으로 떨어지면 자동으로 광고를 내림" />
              </th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.name} style={{ opacity: p.on ? 1 : 0.4 }}>
                <td style={TD}>
                  <Toggle on={p.on} />
                </td>
                <td style={{ ...TD, textAlign: 'left' }}>{p.name}</td>
                <td style={TD}>₩{p.price.toLocaleString()}</td>
                <td style={TD}>{p.margin}%</td>
                <td style={{ ...TD, color: C.primary, fontWeight: 700 }}>{p.adRatio}%</td>
                <td style={TD}>₩{p.dailyMax.toLocaleString()}</td>
                <td style={TD}>₩{p.cpcMax.toLocaleString()}</td>
                <td style={{ ...TD, color: C.success, fontWeight: 700 }}>{p.minRoas}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section title="수익률 등급별 자동 액션">
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <thead>
            <tr>
              <th style={{ ...TH, width: 80 }}>등급</th>
              <th style={{ ...TH, width: 130 }}>광고 수익률</th>
              <th style={{ ...TH, width: 120 }}>예산</th>
              <th style={{ ...TH, width: 130 }}>입찰가</th>
              <th style={{ ...TH, textAlign: 'left' }}>쉽게 말하면</th>
            </tr>
          </thead>
          <tbody>
            {grades.map((g) => (
              <tr key={g.grade}>
                <td style={TD}>
                  <Badge tone={g.tone}>{g.grade}</Badge>
                </td>
                <td style={TD}>{g.roas}</td>
                <td style={TD}>{g.budget}</td>
                <td style={TD}>{g.bid}</td>
                <td style={{ ...TD, textAlign: 'left', color: C.textSec }}>{g.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════
//  탭 2 — 키워드 관리
// ═════════════════════════════════════════════════════════════
type KwSub = 'active' | 'new' | 'blocked';

function KeywordTab() {
  const [sub, setSub] = useState<KwSub>('active');
  const subs: { id: KwSub; label: string; count: number }[] = [
    { id: 'active', label: '운영 중인 키워드', count: 23 },
    { id: 'new', label: '새로 찾은 키워드', count: 7 },
    { id: 'blocked', label: '차단한 키워드', count: 12 },
  ];

  return (
    <div style={{ width: '100%' }}>
      <PageTitle right={<Btn>키워드 등록</Btn>}>키워드 관리</PageTitle>
      <HelpBox>
        <strong>키워드란?</strong> 고객이 네이버에서 검색하는 단어입니다. 예를 들어 누군가
        &quot;임팩트렌치 추천&quot;을 검색하면 우리 광고가 보이도록 그 단어를 등록해두는 거예요.
      </HelpBox>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {subs.map((s) => {
          const isActive = sub === s.id;
          return (
            <button
              key={s.id}
              onClick={() => setSub(s.id)}
              style={{
                background: isActive ? C.primary : '#fff',
                color: isActive ? '#fff' : C.textSec,
                border: `1px solid ${isActive ? C.primary : C.border}`,
                borderRadius: 6,
                padding: '8px 14px',
                fontSize: 13,
                fontWeight: isActive ? 600 : 500,
                fontFamily: 'inherit',
                cursor: 'pointer',
              }}
            >
              {s.label} ({s.count})
            </button>
          );
        })}
      </div>

      {sub === 'active' && <KwActive />}
      {sub === 'new' && <KwNew />}
      {sub === 'blocked' && <KwBlocked />}
    </div>
  );
}

function QualityBar({ score }: { score: number }) {
  return (
    <span style={{ display: 'inline-flex', gap: 2, alignItems: 'center' }}>
      {Array.from({ length: 10 }).map((_, i) => (
        <span
          key={i}
          style={{
            width: 6,
            height: 14,
            borderRadius: 1,
            background: i < score ? C.primary : '#E4E7EE',
          }}
        />
      ))}
      <span style={{ fontSize: 11, color: C.textSec, marginLeft: 6 }}>{score}/10</span>
    </span>
  );
}

function KwActive() {
  const rows: {
    kw: string;
    product: string;
    grade: BadgeTone;
    gradeLabel: string;
    bid: number;
    quality: number;
    cpc: number;
    ctr: number;
    roas: number;
    status: { tone: BadgeTone; label: string };
  }[] = [
    {
      kw: '임팩트렌치 추천',
      product: '밀워키 2967',
      grade: 'green',
      gradeLabel: 'S',
      bid: 320,
      quality: 9,
      cpc: 287,
      ctr: 4.8,
      roas: 542,
      status: { tone: 'green', label: '잘 됨' },
    },
    {
      kw: '밀워키 충전드릴',
      product: '밀워키 2903',
      grade: 'green',
      gradeLabel: 'S',
      bid: 280,
      quality: 8,
      cpc: 245,
      ctr: 4.2,
      roas: 510,
      status: { tone: 'green', label: '잘 됨' },
    },
    {
      kw: '전동공구 세트',
      product: '밀워키 2967',
      grade: 'blue',
      gradeLabel: 'A',
      bid: 310,
      quality: 7,
      cpc: 298,
      ctr: 3.6,
      roas: 380,
      status: { tone: 'blue', label: '안정' },
    },
    {
      kw: 'M18 배터리',
      product: '배터리 5.0Ah',
      grade: 'blue',
      gradeLabel: 'A',
      bid: 220,
      quality: 8,
      cpc: 198,
      ctr: 3.9,
      roas: 365,
      status: { tone: 'blue', label: '안정' },
    },
    {
      kw: '무선 임팩트',
      product: '밀워키 2967',
      grade: 'gray',
      gradeLabel: 'B',
      bid: 260,
      quality: 6,
      cpc: 252,
      ctr: 2.8,
      roas: 245,
      status: { tone: 'gray', label: '본전' },
    },
    {
      kw: '드릴 추천 2026',
      product: '밀워키 2903',
      grade: 'amber',
      gradeLabel: 'C',
      bid: 180,
      quality: 5,
      cpc: 175,
      ctr: 1.9,
      roas: 158,
      status: { tone: 'amber', label: '관찰' },
    },
  ];

  const roasColor = (v: number) =>
    v >= 400 ? C.success : v >= 250 ? C.primary : v >= 150 ? C.warning : C.danger;

  return (
    <div style={{ width: '100%' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 12,
          marginBottom: 20,
          width: '100%',
        }}
      >
        <KpiCard label="운영 중" value="23개" sub="현재 광고가 돌고 있는 키워드" />
        <KpiCard
          label="클릭당 평균 비용"
          value="₩287"
          sub="클릭 한 번당 우리가 낸 돈"
          tooltip="CPC"
        />
        <KpiCard
          label="클릭률"
          value="3.4%"
          sub="100명이 보면 3.4명이 누름"
          tooltip="CTR"
        />
        <KpiCard
          label="광고 수익률"
          value="387%"
          sub="1만원 써서 3.87만원 수익"
          tooltip="ROAS"
        />
      </div>

      <Section title="키워드별 성과">
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <thead>
            <tr>
              <th style={{ ...TH, textAlign: 'left' }}>키워드</th>
              <th style={{ ...TH, width: 130 }}>제품</th>
              <th style={{ ...TH, width: 70 }}>등급</th>
              <th style={{ ...TH, width: 80 }}>입찰가</th>
              <th style={{ ...TH, width: 160 }}>품질점수</th>
              <th style={{ ...TH, width: 90 }}>클릭비용</th>
              <th style={{ ...TH, width: 70 }}>클릭률</th>
              <th style={{ ...TH, width: 80 }}>수익률</th>
              <th style={{ ...TH, width: 80 }}>상태</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.kw}>
                <td style={{ ...TD, textAlign: 'left', fontWeight: 500 }}>{r.kw}</td>
                <td style={{ ...TD, color: C.textSec }}>{r.product}</td>
                <td style={TD}>
                  <Badge tone={r.grade}>{r.gradeLabel}</Badge>
                </td>
                <td style={TD}>₩{r.bid}</td>
                <td style={TD}>
                  <QualityBar score={r.quality} />
                </td>
                <td style={TD}>₩{r.cpc}</td>
                <td style={TD}>{r.ctr}%</td>
                <td style={{ ...TD, color: roasColor(r.roas), fontWeight: 700 }}>{r.roas}%</td>
                <td style={TD}>
                  <Badge tone={r.status.tone}>{r.status.label}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>
    </div>
  );
}

function KwNew() {
  const items: {
    score: number;
    kw: string;
    volume: string;
    competition: string;
    cpc: string;
    source: { tone: BadgeTone; label: string };
  }[] = [
    {
      score: 92,
      kw: '밀워키 임팩트 vs 디월트',
      volume: '월 검색 4,200',
      competition: '경쟁 낮음',
      cpc: '예상 ₩180',
      source: { tone: 'blue', label: '연관검색' },
    },
    {
      score: 88,
      kw: '전동공구 입문자 추천',
      volume: '월 검색 3,100',
      competition: '경쟁 보통',
      cpc: '예상 ₩240',
      source: { tone: 'green', label: '쇼핑인사이트' },
    },
    {
      score: 81,
      kw: 'M18 배터리 충전기 호환',
      volume: '월 검색 2,400',
      competition: '경쟁 낮음',
      cpc: '예상 ₩155',
      source: { tone: 'blue', label: '연관검색' },
    },
    {
      score: 76,
      kw: '목공 드릴 어떤 걸로',
      volume: '월 검색 1,800',
      competition: '경쟁 보통',
      cpc: '예상 ₩210',
      source: { tone: 'amber', label: '검색량급증' },
    },
    {
      score: 68,
      kw: '임팩트렌치 토크 800',
      volume: '월 검색 980',
      competition: '경쟁 높음',
      cpc: '예상 ₩320',
      source: { tone: 'gray', label: '경쟁사키워드' },
    },
  ];

  return (
    <div style={{ width: '100%' }}>
      <HelpBox>
        <strong>새로 찾은 키워드</strong>는 AD-LAB이 매일 새벽 3시에 자동으로 좋은 키워드를
        찾아옵니다. 점수가 높을수록 우리 제품에 잘 맞는 키워드예요.
      </HelpBox>

      <Section title="새로 찾은 키워드">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {items.map((it) => (
            <div
              key={it.kw}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                padding: '12px 14px',
                border: `1px solid ${C.border}`,
                borderRadius: 6,
                background: '#FBFCFE',
              }}
            >
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 6,
                  background: C.primaryLight,
                  color: C.primary,
                  fontSize: 16,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                {it.score}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 4 }}>
                  {it.kw}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: C.textSec,
                    display: 'flex',
                    gap: 14,
                  }}
                >
                  <span>{it.volume}</span>
                  <span>·</span>
                  <span>{it.competition}</span>
                  <span>·</span>
                  <span>{it.cpc}</span>
                </div>
              </div>
              <Badge tone={it.source.tone}>{it.source.label}</Badge>
              <div style={{ display: 'flex', gap: 6 }}>
                <Btn>등록</Btn>
                <Btn variant="secondary">제외</Btn>
              </div>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

function KwBlocked() {
  const rows: {
    kw: string;
    reason: string;
    wastedClicks: number;
    wastedCost: number;
    by: { tone: BadgeTone; label: string };
  }[] = [
    {
      kw: '임팩트렌치 무료',
      reason: '구매 의사 없음 (무료 검색)',
      wastedClicks: 47,
      wastedCost: 13180,
      by: { tone: 'blue', label: 'AD-LAB' },
    },
    {
      kw: '드릴 수리',
      reason: '판매 무관 (수리 문의)',
      wastedClicks: 32,
      wastedCost: 8960,
      by: { tone: 'blue', label: 'AD-LAB' },
    },
    {
      kw: '중고 밀워키',
      reason: '신품 판매 채널 (중고 제외)',
      wastedClicks: 28,
      wastedCost: 7280,
      by: { tone: 'gray', label: '관리자' },
    },
    {
      kw: '임팩트 렌치 사용법',
      reason: '정보 검색 (구매 의사 낮음)',
      wastedClicks: 19,
      wastedCost: 4940,
      by: { tone: 'blue', label: 'AD-LAB' },
    },
  ];

  return (
    <div style={{ width: '100%' }}>
      <HelpBox>
        <strong>차단 키워드란?</strong> 클릭은 일어나지만 절대 안 사는 검색어들입니다. 이런
        키워드는 광고를 안 보이게 차단해서 광고비 낭비를 막습니다.
      </HelpBox>

      <Section title="차단한 키워드">
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <thead>
            <tr>
              <th style={{ ...TH, textAlign: 'left' }}>차단 키워드</th>
              <th style={{ ...TH, textAlign: 'left' }}>차단 이유</th>
              <th style={{ ...TH, width: 120 }}>낭비된 클릭</th>
              <th style={{ ...TH, width: 130 }}>낭비된 금액</th>
              <th style={{ ...TH, width: 110 }}>누가 차단했나</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.kw}>
                <td style={{ ...TD, textAlign: 'left', fontWeight: 500 }}>{r.kw}</td>
                <td style={{ ...TD, textAlign: 'left', color: C.danger }}>{r.reason}</td>
                <td style={TD}>{r.wastedClicks}회</td>
                <td style={{ ...TD, color: C.danger, fontWeight: 700 }}>
                  ₩{r.wastedCost.toLocaleString()}
                </td>
                <td style={TD}>
                  <Badge tone={r.by.tone}>{r.by.label}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════
//  탭 3 — 대시보드
// ═════════════════════════════════════════════════════════════
function DashboardTab() {
  const [hideHelp, setHideHelp] = useState(false);
  useEffect(() => {
    setHideHelp(localStorage.getItem('ad_lab_hide_help') === '1');
  }, []);
  const dismissHelp = () => {
    localStorage.setItem('ad_lab_hide_help', '1');
    setHideHelp(true);
  };

  const [openCampaignId, setOpenCampaignId] = useState<string | null>(null);

  // ⚠️ Step 3-C-1 더미 데이터 (Step 3-C-2에서 API 연결)
  type Campaign = {
    ncc_campaign_id: string;
    name: string;
    status: string;
    daily_budget: number;
    reg_tm: string;
    campaign_tp: string;
    synced_at: string;
  };

  const dummyCampaigns: Campaign[] = [
    { ncc_campaign_id: 'cmp-a001-02-001', name: 'HPT_그라인더_owls',      status: 'ELIGIBLE', daily_budget:     0, reg_tm: '2026-04-22', campaign_tp: 'SHOPPING', synced_at: '2026-05-14T07:37:22Z' },
    { ncc_campaign_id: 'cmp-a001-02-002', name: '콜라보_금속절단기_owls',  status: 'ELIGIBLE', daily_budget: 50000, reg_tm: '2026-04-22', campaign_tp: 'SHOPPING', synced_at: '2026-05-14T07:37:22Z' },
    { ncc_campaign_id: 'cmp-a001-02-003', name: '콜라보_콤프레샤_owls',    status: 'ELIGIBLE', daily_budget: 50000, reg_tm: '2026-04-22', campaign_tp: 'SHOPPING', synced_at: '2026-05-14T07:37:22Z' },
    { ncc_campaign_id: 'cmp-a001-02-004', name: '프레레_집진기_owls',      status: 'ELIGIBLE', daily_budget: 50000, reg_tm: '2026-04-22', campaign_tp: 'SHOPPING', synced_at: '2026-05-14T07:37:22Z' },
    { ncc_campaign_id: 'cmp-a001-02-005', name: '프레레_청소기_owls',      status: 'ELIGIBLE', daily_budget: 50000, reg_tm: '2026-04-22', campaign_tp: 'SHOPPING', synced_at: '2026-05-14T07:37:22Z' },
    { ncc_campaign_id: 'cmp-a001-02-006', name: '대한종합상사_owls',       status: 'PAUSED',   daily_budget: 50000, reg_tm: '2026-04-22', campaign_tp: 'SHOPPING', synced_at: '2026-05-14T07:37:22Z' },
    { ncc_campaign_id: 'cmp-a001-02-007', name: '미라클 동력분무기',       status: 'PAUSED',   daily_budget: 50000, reg_tm: '2026-04-22', campaign_tp: 'SHOPPING', synced_at: '2026-05-14T07:37:22Z' },
    { ncc_campaign_id: 'cmp-a001-02-008', name: '스틸포스 금속절단기',     status: 'PAUSED',   daily_budget: 50000, reg_tm: '2026-04-22', campaign_tp: 'SHOPPING', synced_at: '2026-05-14T07:37:22Z' },
  ];
  const lastSyncedAt = '2026-05-14T07:37:22Z';

  const runningCount  = dummyCampaigns.filter(c => c.status === 'ELIGIBLE').length;
  const pausedCount   = dummyCampaigns.filter(c => c.status === 'PAUSED').length;
  const totalCount    = dummyCampaigns.length;
  const dailyBudgetSum = dummyCampaigns
    .filter(c => c.status === 'ELIGIBLE')
    .reduce((s, c) => s + c.daily_budget, 0);

  type CheckIssue = { campaign: Campaign; rule: 'A' | 'B'; message: string };
  const issues: CheckIssue[] = [];
  dummyCampaigns.forEach(c => {
    if (c.status === 'ELIGIBLE' && c.daily_budget === 0)
      issues.push({ campaign: c, rule: 'A', message: '일예산 0원 → 광고가 노출되지 않습니다' });
    if (c.status === 'PAUSED' && c.daily_budget > 0)
      issues.push({ campaign: c, rule: 'B', message: '예산이 설정돼 있지만 일시정지 상태입니다' });
  });

  const relTime = (iso: string) => {
    const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (diff < 60)    return '방금 전';
    if (diff < 3600)  return `${Math.floor(diff / 60)}분 전`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
    return `${Math.floor(diff / 86400)}일 전`;
  };
  const absTime = (iso: string) => {
    const d = new Date(iso);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mi = String(d.getMinutes()).padStart(2, '0');
    return `${mm}-${dd} ${hh}:${mi}`;
  };
  const fmtKRW = (n: number) => '₩' + n.toLocaleString('ko-KR');

  return (
    <div style={{ width: '100%' }}>

      {/* 상단 헤더 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          marginBottom: 16,
        }}
      >
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: C.text }}>
            자동화 대시보드
          </h1>
          <div style={{ fontSize: 12, color: C.textHint, marginTop: 4 }}>
            마지막 동기화: {relTime(lastSyncedAt)} · {absTime(lastSyncedAt)}
          </div>
        </div>
        <Btn variant="secondary">↻ 동기화</Btn>
      </div>

      {/* 블록 1: 학습 카드 */}
      {!hideHelp && (
        <div
          style={{
            background: C.primaryLight,
            border: `1px solid ${C.primary}`,
            borderRadius: 8,
            padding: '14px 16px',
            marginBottom: 20,
            position: 'relative',
          }}
        >
          <button
            onClick={dismissHelp}
            style={{
              position: 'absolute',
              top: 10,
              right: 12,
              background: 'transparent',
              border: 'none',
              fontSize: 12,
              color: C.textSec,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            숨기기
          </button>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10, color: C.primaryDark }}>
            📚 광고가 어떻게 작동하나요?
          </div>
          <p style={{ fontSize: 13, lineHeight: 1.6, color: C.primaryDark, margin: '0 0 10px' }}>
            네이버 쇼핑광고는 누가 광고를 클릭할 때마다 광고비가 빠집니다.
            클릭당 비용(CPC)이 낮고, 클릭한 사람이 많이 구매할수록 이익이 납니다.
          </p>
          <div
            style={{
              background: '#fff',
              borderRadius: 6,
              padding: '10px 12px',
              fontSize: 12,
              color: C.text,
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: 6, color: C.primaryDark }}>
              예시 (마진율 22% 가정)
            </div>
            <div style={{ color: C.success }}>
              광고비 10,000원 → 매출 50,000원 → 마진 11,000원 → 이익 +1,000원
            </div>
            <div style={{ color: C.danger, marginTop: 4 }}>
              광고비 10,000원 → 매출 30,000원 → 마진 6,600원 → 손해 -3,400원
            </div>
          </div>
        </div>
      )}

      {/* 블록 2: 광고 상태 + 일예산 합계 */}
      <Section title="📊 지금 우리 광고 상태">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
          <div style={{ padding: '12px 16px', background: C.successBg, borderRadius: 8 }}>
            <div style={{ fontSize: 12, color: C.textSec, marginBottom: 6 }}>운영 중인 캠페인</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: C.success }}>
              {runningCount}
              <span style={{ fontSize: 14, fontWeight: 500, marginLeft: 4 }}>
                개 / 총 {totalCount}개
              </span>
            </div>
            <div style={{ fontSize: 16, letterSpacing: 3, marginTop: 6, color: C.success }}>
              {'●'.repeat(runningCount)}
            </div>
          </div>
          <div style={{ padding: '12px 16px', background: C.warningBg, borderRadius: 8 }}>
            <div style={{ fontSize: 12, color: C.textSec, marginBottom: 6 }}>일시정지</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: C.warning }}>
              {pausedCount}
              <span style={{ fontSize: 14, fontWeight: 500, marginLeft: 4 }}>개</span>
            </div>
            <div style={{ fontSize: 16, letterSpacing: 3, marginTop: 6, color: C.warning }}>
              {'○'.repeat(pausedCount)}
            </div>
          </div>
          <div style={{ padding: '12px 16px', background: C.primaryLight, borderRadius: 8 }}>
            <div style={{ fontSize: 12, color: C.textSec, marginBottom: 6 }}>
              운영 중 캠페인의 일예산 합계
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, color: C.primary }}>
              {fmtKRW(dailyBudgetSum)}
            </div>
            <div style={{ fontSize: 11, color: C.textSec, marginTop: 4 }}>
              하루에 최대로 쓸 수 있는 금액
            </div>
          </div>
        </div>
      </Section>

      {/* 블록 3: 캠페인 목록 */}
      <Section title="📋 캠페인 목록" sub={`${totalCount}개 · 행 클릭 시 상세 펼침`}>
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <thead>
            <tr>
              <th style={{ ...TH, textAlign: 'left' }}>캠페인명</th>
              <th style={{ ...TH, width: 100 }}>상태</th>
              <th style={{ ...TH, width: 120 }}>일예산</th>
              <th style={{ ...TH, width: 90 }}>등록일</th>
            </tr>
          </thead>
          <tbody>
            {dummyCampaigns.map((c) => {
              const isOpen = openCampaignId === c.ncc_campaign_id;
              return (
                <Fragment key={c.ncc_campaign_id}>
                  <tr
                    style={{
                      borderTop: `1px solid ${C.borderRow}`,
                      cursor: 'pointer',
                      background: isOpen ? C.primaryLight : 'transparent',
                    }}
                    onClick={() => setOpenCampaignId(isOpen ? null : c.ncc_campaign_id)}
                  >
                    <td style={{ ...TD, textAlign: 'left', fontWeight: 500 }}>{c.name}</td>
                    <td style={TD}>
                      {c.status === 'ELIGIBLE'
                        ? <Badge tone="green">운영 중</Badge>
                        : <Badge tone="amber">일시정지</Badge>
                      }
                    </td>
                    <td
                      style={{
                        ...TD,
                        textAlign: 'right',
                        color: c.daily_budget === 0 ? C.danger : C.text,
                        fontWeight: c.daily_budget === 0 ? 600 : 400,
                      }}
                    >
                      {fmtKRW(c.daily_budget)}
                    </td>
                    <td style={{ ...TD, color: C.textSec }}>{c.reg_tm.slice(5)}</td>
                  </tr>
                  {isOpen && (
                    <tr style={{ background: '#F8FAFD' }}>
                      <td
                        colSpan={4}
                        style={{
                          padding: '12px 16px',
                          fontSize: 12,
                          color: C.textSec,
                          lineHeight: 1.9,
                          borderTop: `1px solid ${C.border}`,
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div>캠페인 종류: {c.campaign_tp === 'SHOPPING' ? '쇼핑검색 (SHOPPING)' : c.campaign_tp}</div>
                        <div>마지막 동기화: {absTime(c.synced_at)}</div>
                        <div>네이버 캠페인 ID: {c.ncc_campaign_id}</div>
                        <a
                          href="https://manage.searchad.naver.com"
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            color: C.primary,
                            fontSize: 12,
                            marginTop: 6,
                            display: 'inline-block',
                          }}
                        >
                          🔗 네이버 광고 관리자에서 열기
                        </a>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </Section>

      {/* 블록 4: 점검 필요 */}
      <Section title="⚠️ 점검 필요" sub={`${issues.length}건`}>
        {issues.length === 0 ? (
          <div style={{ fontSize: 13, color: C.success, padding: '8px 0' }}>
            ✅ 점검 필요한 항목이 없습니다.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {issues.map((iss, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 14px',
                  background: iss.rule === 'A' ? C.dangerBg : C.warningBg,
                  borderRadius: 6,
                  fontSize: 13,
                }}
              >
                <Badge tone={iss.rule === 'A' ? 'red' : 'amber'}>
                  {iss.rule === 'A' ? '규칙 A' : '규칙 B'}
                </Badge>
                <span style={{ fontWeight: 600 }}>{iss.campaign.name}</span>
                <span style={{ color: C.textSec }}>— {iss.message}</span>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* 블록 5: 다음 단계 */}
      <Section title="🛣️ 다음 단계">
        <div style={{ fontSize: 13, color: C.text, lineHeight: 1.8 }}>
          <div>키워드별 매출·클릭 데이터는 14일치 데이터가 쌓이면 표시됩니다.</div>
          <div>자동 수집을 켜려면 [설정] 탭 → 자동화 엔진 ON으로 이동하세요.</div>
          <div
            style={{
              marginTop: 10,
              padding: '8px 12px',
              background: C.thBg,
              borderRadius: 6,
              fontSize: 12,
              color: C.textSec,
            }}
          >
            현재 단계: Phase 0 (API 연결 완료) → 다음: Phase 1 (데이터 수집 14일)
          </div>
        </div>
      </Section>

      {/* 하단: 광고 용어 사전 */}
      <div
        style={{
          marginTop: 8,
          marginBottom: 24,
          padding: 16,
          background: C.surface,
          border: `1px solid ${C.border}`,
          borderRadius: 8,
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, color: C.text }}>
          📖 광고 용어 사전
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '6px 24px',
            fontSize: 12,
          }}
        >
          {(
            [
              ['CPC',          '클릭당 비용. 광고를 한 번 클릭할 때 빠지는 광고비.'],
              ['ROAS',         '광고 수익률. (광고 매출 ÷ 광고비) × 100%.'],
              ['일예산',        '하루에 최대로 쓸 수 있는 광고비 한도.'],
              ['노출수',        '광고가 사용자 화면에 나타난 횟수.'],
              ['클릭률(CTR)',   '노출 중 클릭된 비율. (클릭 ÷ 노출) × 100%.'],
              ['전환',          '광고 클릭 → 실제 구매로 이어진 경우.'],
              ['손익분기 ROAS', '이익이 0이 되는 ROAS. 마진율 22%면 455%.'],
              ['품질지수',      '키워드 품질 점수 1~10. 높을수록 같은 입찰가로 위 노출.'],
            ] as [string, string][]
          ).map(([term, def]) => (
            <div key={term} style={{ display: 'flex', gap: 8 }}>
              <span style={{ fontWeight: 700, color: C.primary, minWidth: 90, flexShrink: 0 }}>
                {term}
              </span>
              <span style={{ color: C.textSec }}>{def}</span>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}

// ═════════════════════════════════════════════════════════════
//  탭 4 — 실행 로그
// ═════════════════════════════════════════════════════════════
function LogTab() {
  const logs: {
    time: string;
    title: string;
    detail: string;
    tag: { tone: BadgeTone; label: string };
  }[] = [
    {
      time: '14:32',
      title: '"임팩트렌치 추천" 입찰가를 320원 → 285원으로 낮춤',
      detail: '클릭은 같은데 비용만 줄어듦 (예상 절약 ₩2,400/일)',
      tag: { tone: 'green', label: '비용 절약' },
    },
    {
      time: '13:18',
      title: '"밀워키 충전드릴" 1위 자리 차지',
      detail: '경쟁사 B가 예산 소진 → 우리 광고만 노출 시작',
      tag: { tone: 'blue', label: '1위 점령' },
    },
    {
      time: '12:05',
      title: '"드릴 추천 2026" 등급 B → C 하락 → 입찰가 −10%',
      detail: '수익률 158%로 떨어짐 → 자동 방어 발동',
      tag: { tone: 'amber', label: '전략 전환' },
    },
    {
      time: '11:42',
      title: '"M18 배터리" 클릭당 비용 220원 → 198원',
      detail: '품질점수가 7→8로 올라서 같은 순위에 더 싸게 노출됨',
      tag: { tone: 'green', label: '비용 절약' },
    },
    {
      time: '10:30',
      title: '새 키워드 5개 후보 발견',
      detail: '점수 76점 이상 — 검토 후 등록 대기 중',
      tag: { tone: 'blue', label: '키워드 발견' },
    },
    {
      time: '09:18',
      title: '"드릴 추천 2026" 등급 B → C 강등',
      detail: '최근 3일 수익률 평균이 200% 미만으로 떨어짐',
      tag: { tone: 'amber', label: '등급 하락' },
    },
    {
      time: '08:45',
      title: '"임팩트렌치 무료" 키워드 자동 차단',
      detail: '클릭 47회 / 매출 0건 → 광고비 ₩13,180 낭비 차단',
      tag: { tone: 'red', label: '돈 아끼기' },
    },
    {
      time: '07:22',
      title: '디월트 DCF887 광고 일시정지 → M18 충전드릴로 예산 이동',
      detail: '디월트 수익률 99% 미만 → 잘 팔리는 제품에 예산 재배분',
      tag: { tone: 'amber', label: '예산 이동' },
    },
  ];

  return (
    <div
      style={{
        width: '100%',
        minWidth: '100%',
        maxWidth: '100%',
        display: 'block',
        boxSizing: 'border-box',
      }}
    >
      <PageTitle right={<Btn variant="secondary">내보내기</Btn>}>실행 로그</PageTitle>
      <HelpBox>
        AD-LAB이 자동으로 한 일을 시간순으로 보여줍니다. 사람이 일일이 확인하지 않아도 어떤 결정을
        내렸는지 한눈에 알 수 있어요.
      </HelpBox>

      <Section
        title="오늘 AD-LAB이 한 일"
        right={<span style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>총 47건</span>}
      >
        {logs.map((l, idx) => (
          <div
            key={idx}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              padding: '12px 4px',
              borderBottom:
                idx === logs.length - 1 ? 'none' : `1px solid ${C.borderRow}`,
              width: '100%',
              boxSizing: 'border-box',
            }}
          >
            <div
              style={{
                width: 48,
                fontSize: 13,
                fontWeight: 600,
                color: C.primary,
                flexShrink: 0,
                fontFeatureSettings: "'tnum' 1",
              }}
            >
              {l.time}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 500, color: C.text, marginBottom: 2 }}>
                {l.title}
              </div>
              <div style={{ fontSize: 12, color: C.textHint }}>{l.detail}</div>
            </div>
            <Badge tone={l.tag.tone}>{l.tag.label}</Badge>
          </div>
        ))}
      </Section>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════
//  탭 5 — 설정
// ═════════════════════════════════════════════════════════════
function SettingTab() {
  const [adStatus, setAdStatus] = useState<'loading' | 'connected' | 'not_configured'>('loading');

  useEffect(() => {
    fetch('/api/settings/api-status')
      .then(r => r.json())
      .then(data => {
        const naverAd = (data.platforms ?? []).find((p: any) => p.id === 'naverAd');
        setAdStatus(naverAd?.status === 'connected' ? 'connected' : 'not_configured');
      })
      .catch(() => setAdStatus('not_configured'));
  }, []);

  const guards = [
    { label: '한 번에 입찰가 최대 변경', desc: '한 키워드 입찰가 1회 조정 한도', value: '±30%' },
    {
      label: '하루에 같은 키워드 변경 횟수',
      desc: '동일 키워드 일일 조정 상한',
      value: '최대 6회',
    },
    {
      label: '하루에 새 키워드 자동 등록',
      desc: 'AD-LAB이 하루에 추가하는 키워드 수',
      value: '최대 5개',
    },
    {
      label: '예산 긴급 브레이크',
      desc: '일 예산 소진율이 이 값에 도달하면 정지',
      value: '90% 사용 시',
    },
    {
      label: '자동 정지 전 대기 시간',
      desc: '문제 감지 후 즉시 정지하지 않고 관찰',
      value: '24시간',
    },
    {
      label: '새 키워드 관찰 기간',
      desc: '신규 키워드 성과 평가 유예 기간',
      value: '14일',
    },
  ];

  const engines: {
    on: boolean;
    job: string;
    freq: string;
    last: string;
    next: string;
  }[] = [
    {
      on: true,
      job: '클릭비용 자동 조절',
      freq: '매 1시간',
      last: '14:32',
      next: '15:32',
    },
    {
      on: true,
      job: '경쟁사 광고비 소진 감시',
      freq: '매 6시간',
      last: '12:00',
      next: '18:00',
    },
    {
      on: true,
      job: '새 키워드 찾기 + 성적표',
      freq: '매일 새벽 3시',
      last: '오늘 03:00',
      next: '내일 03:00',
    },
    {
      on: true,
      job: '품질점수 관리',
      freq: '매일 새벽 6시',
      last: '오늘 06:00',
      next: '내일 06:00',
    },
    {
      on: false,
      job: '주간 보고서',
      freq: '매주 월요일',
      last: '지난주 월 09:00',
      next: '다음주 월 09:00',
    },
  ];

  return (
    <div style={{ width: '100%' }}>
      <PageTitle>설정</PageTitle>

      <Section title="네이버 검색광고 API 연결 상태">
        <p style={{ fontSize: 13, color: C.textSec, margin: '0 0 12px', width: '100%' }}>
          API 키는 <strong>설정 &gt; API 관리</strong>에서 등록합니다.
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
          {adStatus === 'loading' && (
            <>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#9BA3B2', display: 'inline-block' }} />
              <span style={{ fontSize: 14, fontWeight: 600, color: '#9BA3B2' }}>확인 중...</span>
            </>
          )}
          {adStatus === 'connected' && (
            <>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: C.success, display: 'inline-block' }} />
              <span style={{ fontSize: 14, fontWeight: 600, color: C.success }}>연결됨</span>
            </>
          )}
          {adStatus === 'not_configured' && (
            <>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: C.danger, display: 'inline-block' }} />
              <span style={{ fontSize: 14, fontWeight: 600, color: C.danger }}>미연결</span>
              <span style={{ fontSize: 12, color: C.textHint, marginLeft: 6 }}>(설정 &gt; API 관리에서 키 등록 후 연결됩니다)</span>
            </>
          )}
        </div>
      </Section>

      <Section
        title="자동화 안전장치"
        sub="AD-LAB이 실수하지 않도록 걸어둔 제한들"
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 14,
            width: '100%',
          }}
        >
          {guards.map((g) => (
            <div
              key={g.label}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px 14px',
                border: `1px solid ${C.border}`,
                borderRadius: 6,
                background: '#FBFCFE',
              }}
            >
              <div style={{ flex: 1, minWidth: 0, paddingRight: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 2 }}>
                  {g.label}
                </div>
                <div style={{ fontSize: 11, color: C.textHint }}>{g.desc}</div>
              </div>
              <div
                style={{
                  fontSize: 15,
                  fontWeight: 700,
                  color: C.primary,
                  whiteSpace: 'nowrap',
                }}
              >
                {g.value}
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section
        title="자동화 엔진 상태"
        sub="Windows 서브PC에서 돌아가는 스케줄러 현황"
      >
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <thead>
            <tr>
              <th style={{ ...TH, width: 70 }}>상태</th>
              <th style={{ ...TH, textAlign: 'left' }}>하는 일</th>
              <th style={{ ...TH, width: 140 }}>얼마나 자주</th>
              <th style={{ ...TH, width: 150 }}>최근 실행</th>
              <th style={{ ...TH, width: 150 }}>다음 실행</th>
            </tr>
          </thead>
          <tbody>
            {engines.map((e) => (
              <tr key={e.job}>
                <td style={TD}>
                  <span
                    style={{
                      display: 'inline-block',
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      background: e.on ? C.success : '#C9CCD4',
                    }}
                  />
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: e.on ? C.success : C.textHint,
                      marginLeft: 6,
                    }}
                  >
                    {e.on ? 'ON' : 'OFF'}
                  </span>
                </td>
                <td style={{ ...TD, textAlign: 'left', fontWeight: 500 }}>{e.job}</td>
                <td style={{ ...TD, color: C.textSec }}>{e.freq}</td>
                <td style={{ ...TD, color: C.textSec }}>{e.last}</td>
                <td style={{ ...TD, color: C.textSec }}>{e.next}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>
    </div>
  );
}
