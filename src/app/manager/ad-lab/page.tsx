'use client';

import { useState } from 'react';

type SubTab = 'budget' | 'keyword' | 'dashboard' | 'log' | 'setting';

const SUB_TABS: { id: SubTab; label: string }[] = [
  { id: 'budget', label: '예산 설정' },
  { id: 'keyword', label: '키워드 관리' },
  { id: 'dashboard', label: '대시보드' },
  { id: 'log', label: '실행 로그' },
  { id: 'setting', label: '설정' },
];

const PHASE1_NOTICE = 'Phase 1 완료 후 활성화됩니다';

export default function AdLabPage() {
  const [activeTab, setActiveTab] = useState<SubTab>('budget');
  const [customerId, setCustomerId] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [secretKey, setSecretKey] = useState('');

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#F4F6FA',
        fontFamily: "'Pretendard', -apple-system, sans-serif",
        color: '#1A1D23',
      }}
    >
      {/* 서브탭 바 */}
      <div
        style={{
          background: '#FFFFFF',
          borderBottom: '1px solid #DDE1EB',
          display: 'flex',
          padding: '0 24px',
        }}
      >
        {SUB_TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                background: 'transparent',
                border: 'none',
                padding: '12px 16px',
                fontSize: 13,
                fontWeight: isActive ? 600 : 500,
                color: isActive ? '#185FA5' : '#5A6070',
                cursor: 'pointer',
                borderBottom: isActive ? '2px solid #185FA5' : '2px solid transparent',
                fontFamily: 'inherit',
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* 콘텐츠 영역 */}
      <div style={{ maxWidth: 1320, margin: '0 auto', padding: '16px 24px' }}>
        {activeTab === 'setting' ? (
          <SettingPanel
            customerId={customerId}
            setCustomerId={setCustomerId}
            apiKey={apiKey}
            setApiKey={setApiKey}
            secretKey={secretKey}
            setSecretKey={setSecretKey}
          />
        ) : (
          <PlaceholderPanel title={SUB_TABS.find((t) => t.id === activeTab)?.label ?? ''} />
        )}
      </div>
    </div>
  );
}

function PlaceholderPanel({ title }: { title: string }) {
  return (
    <div
      style={{
        background: '#FFFFFF',
        border: '1px solid #DDE1EB',
        borderRadius: 6,
        padding: '32px 24px',
      }}
    >
      <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0, color: '#1A1D23' }}>{title}</h2>
      <p style={{ fontSize: 13, color: '#5A6070', marginTop: 12, marginBottom: 0 }}>
        {PHASE1_NOTICE}
      </p>
    </div>
  );
}

function SettingPanel({
  customerId,
  setCustomerId,
  apiKey,
  setApiKey,
  secretKey,
  setSecretKey,
}: {
  customerId: string;
  setCustomerId: (v: string) => void;
  apiKey: string;
  setApiKey: (v: string) => void;
  secretKey: string;
  setSecretKey: (v: string) => void;
}) {
  return (
    <div
      style={{
        background: '#FFFFFF',
        border: '1px solid #DDE1EB',
        borderRadius: 6,
        overflow: 'hidden',
      }}
    >
      {/* 섹션 헤더 (다크) */}
      <div
        style={{
          background: '#1A1D23',
          color: '#FFFFFF',
          padding: '12px 16px',
          fontSize: 15,
          fontWeight: 600,
        }}
      >
        네이버 검색광고 API 연결
      </div>

      <div style={{ padding: '20px 24px' }}>
        <p style={{ fontSize: 13, color: '#5A6070', margin: '0 0 16px' }}>
          searchad.naver.com에서 발급받은 키 3개를 입력하세요
        </p>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 16,
          }}
        >
          <KeyField
            label="CUSTOMER_ID"
            value={customerId}
            onChange={setCustomerId}
            placeholder="예: 1234567"
          />
          <KeyField
            label="API_KEY"
            value={apiKey}
            onChange={setApiKey}
            placeholder="API 키"
          />
          <KeyField
            label="SECRET_KEY"
            value={secretKey}
            onChange={setSecretKey}
            placeholder="시크릿 키"
          />
        </div>
      </div>
    </div>
  );
}

function KeyField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontSize: 12, fontWeight: 500, color: '#5A6070' }}>{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        style={{
          height: 36,
          border: '1px solid #DDE1EB',
          borderRadius: 6,
          padding: '0 10px',
          fontSize: 13,
          color: '#1A1D23',
          fontFamily: 'inherit',
          outline: 'none',
        }}
      />
    </label>
  );
}
