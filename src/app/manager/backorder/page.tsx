'use client';

import { useEffect, useState } from 'react';
import type { Backorder, BackordersResponse } from './types';

export default function BackorderPage() {
  const [items, setItems] = useState<Backorder[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let aborted = false;
    (async () => {
      try {
        const res = await fetch('/api/backorders');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json: BackordersResponse = await res.json();
        if (aborted) return;
        if (!json.success) throw new Error('API 응답 실패');
        setItems(json.data || []);
      } catch (e: unknown) {
        if (aborted) return;
        setError(e instanceof Error ? e.message : '알 수 없는 오류');
      }
    })();
    return () => {
      aborted = true;
    };
  }, []);

  const containerStyle: React.CSSProperties = {
    padding: 24,
    fontFamily: "'Pretendard', -apple-system, sans-serif",
  };

  if (error) {
    return (
      <div style={containerStyle}>
        <p style={{ color: '#B22222' }}>에러: {error}</p>
      </div>
    );
  }

  if (items === null) {
    return (
      <div style={containerStyle}>
        <p>불러오는 중...</p>
      </div>
    );
  }

  const recent = items.slice(0, 5);

  return (
    <div style={containerStyle}>
      <h1 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>
        백오더 {items.length.toLocaleString()}건
      </h1>
      {recent.length === 0 ? (
        <p style={{ color: '#9BA3B2' }}>등록된 백오더가 없습니다.</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {recent.map((b) => (
            <li
              key={b.id}
              style={{
                padding: '10px 0',
                borderBottom: '1px solid #EEF0F4',
                fontSize: 13,
              }}
            >
              <span style={{ fontWeight: 600 }}>{b.product_name}</span>
              <span style={{ color: '#5A6070', margin: '0 8px' }}>·</span>
              <span>{b.customer_name}</span>
              <span style={{ color: '#5A6070', margin: '0 8px' }}>·</span>
              <span>{b.quantity.toLocaleString()}개</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
