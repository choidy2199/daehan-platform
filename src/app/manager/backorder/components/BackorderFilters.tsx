'use client';

import { useEffect, useRef, useState } from 'react';

export type FilterType = 'all' | 'milwaukee' | 'general' | 'import';
export type FilterStatus = 'all' | 'waiting' | 'partial' | 'done';

interface Props {
  filterType: FilterType;
  filterStatus: FilterStatus;
  search: string;
  onTypeChange: (t: FilterType) => void;
  onStatusChange: (s: FilterStatus) => void;
  onSearchChange: (s: string) => void;
}

const TYPE_OPTIONS: { key: FilterType; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'milwaukee', label: '밀워키' },
  { key: 'general', label: '일반' },
  { key: 'import', label: '수입' },
];

const STATUS_OPTIONS: { key: FilterStatus; label: string }[] = [
  { key: 'all', label: '상태전체' },
  { key: 'waiting', label: '대기' },
  { key: 'partial', label: '부분' },
  { key: 'done', label: '완료' },
];

function buttonStyle(isActive: boolean): React.CSSProperties {
  return {
    background: isActive ? '#1A1D23' : '#fff',
    color: isActive ? '#fff' : '#5A6070',
    border: `1px solid ${isActive ? '#1A1D23' : '#DDE1EB'}`,
    borderRadius: 6,
    padding: '4px 12px',
    fontSize: 12,
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: "'Pretendard', -apple-system, sans-serif",
  };
}

export default function BackorderFilters({
  filterType,
  filterStatus,
  search,
  onTypeChange,
  onStatusChange,
  onSearchChange,
}: Props) {
  const [localSearch, setLocalSearch] = useState(search);
  const composingRef = useRef(false);

  useEffect(() => {
    setLocalSearch(search);
  }, [search]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        padding: '10px 20px',
        background: '#fafafa',
        borderBottom: '0.5px solid #eee',
        flexWrap: 'wrap',
      }}
    >
      {TYPE_OPTIONS.map((opt) => (
        <button
          key={opt.key}
          onClick={() => onTypeChange(opt.key)}
          style={buttonStyle(filterType === opt.key)}
        >
          {opt.label}
        </button>
      ))}
      <div style={{ width: 1, height: 20, background: '#DDE1EB', margin: '0 4px' }} />
      {STATUS_OPTIONS.map((opt) => (
        <button
          key={opt.key}
          onClick={() => onStatusChange(opt.key)}
          style={buttonStyle(filterStatus === opt.key)}
        >
          {opt.label}
        </button>
      ))}
      <input
        type="text"
        value={localSearch}
        placeholder="제품명, 거래처 검색..."
        autoComplete="off"
        onChange={(e) => {
          const v = e.target.value;
          setLocalSearch(v);
          if (!composingRef.current) onSearchChange(v);
        }}
        onCompositionStart={() => {
          composingRef.current = true;
        }}
        onCompositionEnd={(e) => {
          composingRef.current = false;
          onSearchChange((e.target as HTMLInputElement).value);
        }}
        style={{
          marginLeft: 'auto',
          width: 200,
          height: 32,
          border: '1px solid #DDE1EB',
          borderRadius: 6,
          padding: '0 10px',
          fontSize: 13,
          fontFamily: "'Pretendard', -apple-system, sans-serif",
        }}
      />
    </div>
  );
}
