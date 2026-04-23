'use client';

import { useEffect, useState, CSSProperties, ReactNode } from 'react';

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
  return (
    <div style={{ width: '100%' }}>
      <PageTitle right={<Btn variant="danger">전체 자동화 중지</Btn>}>
        자동화 대시보드
      </PageTitle>
      <HelpBox>
        이 화면은 AD-LAB이 자동으로 관리하고 있는 현황을 보여줍니다. 사람이 손대지 않아도 24시간
        키워드 입찰을 조절하고, 새 키워드를 찾고, 낭비를 막고 있어요.
      </HelpBox>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 12,
          marginBottom: 20,
          width: '100%',
        }}
      >
        <KpiCard
          variant="main"
          label="오늘 쓴 광고비"
          value="₩45,200"
          sub="일 예산 ₩60,000 중 75%"
        />
        <KpiCard
          label="광고 수익률"
          value="387%"
          sub="1만원 써서 3.87만원 수익"
          tooltip="ROAS"
        />
        <KpiCard label="운영 중인 키워드" value="23개" sub="자동으로 관리 중" />
        <KpiCard
          label="AD-LAB이 절약한 돈"
          value="₩12,400"
          sub="자동 차단으로 줄인 낭비"
        />
      </div>

      <Section title="시간대별 클릭비용 지도">
        <Heatmap />
        <HeatmapLegend />
      </Section>

      <Section title="경쟁사 광고비 소진 시간">
        <CompetitorBars />
      </Section>
    </div>
  );
}

function Heatmap() {
  const days = ['월', '화', '수', '목', '금', '토', '일'];
  const colorOf = (d: number, h: number) => {
    const v = (d * 31 + h * 17 + h * d * 3) % 100;
    if (v < 40) return C.successBg;
    if (v < 70) return C.primaryLight;
    if (v < 90) return C.warning;
    return C.danger;
  };
  return (
    <div style={{ width: '100%' }}>
      <table
        style={{
          width: '100%',
          tableLayout: 'fixed',
          borderCollapse: 'separate',
          borderSpacing: 3,
        }}
      >
        <colgroup>
          <col style={{ width: 28 }} />
          {Array.from({ length: 24 }).map((_, h) => (
            <col key={h} />
          ))}
        </colgroup>
        <thead>
          <tr>
            <th />
            {Array.from({ length: 24 }).map((_, h) => (
              <th
                key={h}
                style={{
                  fontSize: 10,
                  color: C.textHint,
                  fontWeight: 500,
                  paddingBottom: 4,
                  textAlign: 'center',
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {days.map((d, di) => (
            <tr key={d}>
              <td
                style={{
                  fontSize: 11,
                  color: C.textSec,
                  fontWeight: 500,
                  paddingRight: 6,
                  textAlign: 'right',
                }}
              >
                {d}
              </td>
              {Array.from({ length: 24 }).map((_, h) => (
                <td
                  key={h}
                  style={{
                    height: 24,
                    background: colorOf(di, h),
                    borderRadius: 2,
                  }}
                />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function HeatmapLegend() {
  const items = [
    { c: C.successBg, label: '싸다' },
    { c: C.primaryLight, label: '보통' },
    { c: C.warning, label: '비싸다' },
    { c: C.danger, label: '매우 비싸다' },
  ];
  return (
    <div
      style={{
        display: 'flex',
        gap: 16,
        marginTop: 14,
        justifyContent: 'center',
        fontSize: 12,
        color: C.textSec,
      }}
    >
      {items.map((it) => (
        <div key={it.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{
              width: 14,
              height: 14,
              background: it.c,
              borderRadius: 2,
              display: 'inline-block',
            }}
          />
          <span>{it.label}</span>
        </div>
      ))}
    </div>
  );
}

function CompetitorBars() {
  const items = [
    {
      kw: '임팩트렌치 추천',
      rival: '경쟁사 A',
      info: '오늘 09:00~14:30 광고 운영 → 14:30 예산 소진. 14:30 이후 우리만 노출 (9시간 30분 독점)',
      activeRatio: 60,
    },
    {
      kw: '밀워키 충전드릴',
      rival: '경쟁사 B',
      info: '오늘 10:30~16:00 광고 운영 → 16:00 예산 소진. 16:00 이후 우리만 노출 (8시간 독점)',
      activeRatio: 65,
    },
    {
      kw: 'M18 배터리',
      rival: '경쟁사 C',
      info: '오늘 08:00~11:45 광고 운영 → 11:45 예산 소진. 11:45 이후 우리만 노출 (12시간 15분 독점)',
      activeRatio: 40,
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {items.map((it) => (
        <div key={it.kw}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>
              {it.kw}{' '}
              <span style={{ color: C.textSec, fontWeight: 400, fontSize: 12 }}>
                · {it.rival}
              </span>
            </span>
          </div>
          <div style={{ fontSize: 12, color: C.textSec, marginBottom: 8 }}>{it.info}</div>
          <div
            style={{
              display: 'flex',
              height: 32,
              borderRadius: 4,
              overflow: 'hidden',
              border: `1px solid ${C.border}`,
              width: '100%',
            }}
          >
            <div
              style={{
                width: `${it.activeRatio}%`,
                background: C.dangerBg,
                color: '#791F1F',
                fontSize: 11,
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              경쟁사 광고 켜져있음
            </div>
            <div
              style={{
                width: `${100 - it.activeRatio}%`,
                background: C.successBg,
                color: '#085041',
                fontSize: 11,
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              우리만 노출 (독점!)
            </div>
          </div>
        </div>
      ))}
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
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: C.danger,
              display: 'inline-block',
            }}
          />
          <span style={{ fontSize: 14, fontWeight: 600, color: C.danger }}>미연결</span>
          <span style={{ fontSize: 12, color: C.textHint, marginLeft: 6 }}>
            (연결되면 초록 dot + &quot;연결됨&quot;으로 변경됩니다)
          </span>
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
