'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Backorder, BackordersResponse } from './types';
import BackorderHeader from './components/BackorderHeader';
import BackorderKPI from './components/BackorderKPI';
import BackorderFilters, {
  type FilterType,
  type FilterStatus,
} from './components/BackorderFilters';

export default function BackorderPage() {
  const [items, setItems] = useState<Backorder[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [search, setSearch] = useState('');

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

  const counts = useMemo(() => {
    const data = items || [];
    return {
      total: data.length,
      waiting: data.filter((d) => d.status === 'waiting').length,
      partial: data.filter((d) => d.status === 'partial').length,
      done: data.filter((d) => d.status === 'done').length,
      stockIn: 0,
    };
  }, [items]);

  const filtered = useMemo(() => {
    const data = items || [];
    const q = search.trim().toLowerCase();
    return data.filter((d) => {
      if (filterType !== 'all' && d.product_type !== filterType) return false;
      if (filterStatus !== 'all' && d.status !== filterStatus) return false;
      if (q) {
        if (
          !(d.product_name || '').toLowerCase().includes(q) &&
          !(d.customer_name || '').toLowerCase().includes(q) &&
          !(d.model || '').toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [items, filterType, filterStatus, search]);

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

  return (
    <div style={containerStyle}>
      <div
        style={{
          background: '#fff',
          border: '0.5px solid #eee',
          borderRadius: 8,
          overflow: 'hidden',
        }}
      >
        <BackorderHeader
          totalCount={counts.total}
          waitingCount={counts.waiting}
          stockInCount={counts.stockIn}
          onAddClick={() => alert('Step 4에서 구현')}
        />
        <BackorderKPI
          waitingCount={counts.waiting}
          partialCount={counts.partial}
          doneCount={counts.done}
          stockInCount={counts.stockIn}
        />
        <BackorderFilters
          filterType={filterType}
          filterStatus={filterStatus}
          search={search}
          onTypeChange={setFilterType}
          onStatusChange={setFilterStatus}
          onSearchChange={setSearch}
        />
        <div
          style={{
            padding: 24,
            textAlign: 'center',
            color: '#9BA3B2',
            fontSize: 14,
          }}
        >
          {filtered.length.toLocaleString()}건 (테이블 Step 3)
        </div>
      </div>
    </div>
  );
}
