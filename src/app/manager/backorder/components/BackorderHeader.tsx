'use client';

interface Props {
  totalCount: number;
  waitingCount: number;
  stockInCount: number;
  onAddClick: () => void;
}

export default function BackorderHeader({ totalCount, waitingCount, stockInCount, onAddClick }: Props) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '14px 20px',
        background: '#1A1D23',
        color: '#fff',
        borderRadius: '8px 8px 0 0',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 18, fontWeight: 500 }}>백오더</span>
        <span style={{ fontSize: 14, color: 'rgba(255,255,255,.5)' }}>{totalCount.toLocaleString()}건</span>
        {waitingCount > 0 && (
          <span
            style={{
              fontSize: 11,
              padding: '3px 10px',
              borderRadius: 10,
              background: '#E24B4A',
              color: '#fff',
              fontWeight: 500,
            }}
          >
            대기 {waitingCount}
          </span>
        )}
        {stockInCount > 0 && (
          <span
            style={{
              fontSize: 11,
              padding: '3px 10px',
              borderRadius: 10,
              background: '#1D9E75',
              color: '#fff',
              fontWeight: 500,
            }}
          >
            입고 {stockInCount}
          </span>
        )}
      </div>
      <button
        onClick={onAddClick}
        style={{
          fontSize: 13,
          padding: '7px 16px',
          borderRadius: 6,
          background: '#378ADD',
          color: '#fff',
          border: 'none',
          cursor: 'pointer',
          fontWeight: 500,
          fontFamily: "'Pretendard', -apple-system, sans-serif",
        }}
      >
        + 백오더 등록
      </button>
    </div>
  );
}
