'use client';

interface Props {
  waitingCount: number;
  partialCount: number;
  doneCount: number;
  stockInCount: number;
}

interface Card {
  label: string;
  value: number;
  color: string;
  bg: string;
}

export default function BackorderKPI({ waitingCount, partialCount, doneCount, stockInCount }: Props) {
  const cards: Card[] = [
    { label: '대기', value: waitingCount, color: '#BA7517', bg: '#fafafa' },
    { label: '부분출고', value: partialCount, color: '#0C447C', bg: '#fafafa' },
    { label: '완료', value: doneCount, color: '#085041', bg: '#fafafa' },
    {
      label: '입고 알림',
      value: stockInCount,
      color: stockInCount > 0 ? '#2D7D2D' : '#999',
      bg: stockInCount > 0 ? '#EAF3DE' : '#fafafa',
    },
  ];

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 10,
        padding: '16px 20px',
        borderBottom: '0.5px solid #eee',
      }}
    >
      {cards.map((c) => (
        <div
          key={c.label}
          style={{
            background: c.bg,
            borderRadius: 8,
            padding: '12px 16px',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 12, color: '#999', marginBottom: 4 }}>{c.label}</div>
          <div style={{ fontSize: 22, fontWeight: 500, color: c.color }}>{c.value.toLocaleString()}</div>
        </div>
      ))}
    </div>
  );
}
