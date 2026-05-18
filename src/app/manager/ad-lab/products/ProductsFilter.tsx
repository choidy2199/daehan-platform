'use client';

import { useMemo, useState, useEffect } from 'react';
import type {
  ProductFilters,
  ProductRow,
  SourceTypeFilter,
  StatusFilter,
  EfficiencyFilter,
} from './types';

interface Campaign {
  id: string;
  name: string;
}

interface ProductsFilterProps {
  filters: ProductFilters;
  onChange: (next: ProductFilters) => void;
  rows: ProductRow[];
  campaigns: Campaign[];
  filteredCount: number;
}

export function ProductsFilter({
  filters,
  onChange,
  rows,
  campaigns,
  filteredCount,
}: ProductsFilterProps) {
  const counts = useMemo(() => {
    let milwaukee = 0;
    let general = 0;
    let unmatched = 0;
    let on = 0;
    let off = 0;
    for (const row of rows) {
      if (!row.matched) unmatched++;
      else if (row.product_source === 'milwaukee') milwaukee++;
      else if (row.product_source === 'general') general++;
      if (row.status === 'ELIGIBLE') on++;
      else off++;
    }
    return { total: rows.length, milwaukee, general, unmatched, on, off };
  }, [rows]);

  const [showAllCampaigns, setShowAllCampaigns] = useState(false);
  const visibleCampaigns = showAllCampaigns ? campaigns : campaigns.slice(0, 3);
  const hiddenCount = campaigns.length - visibleCampaigns.length;

  const [searchDraft, setSearchDraft] = useState(filters.searchQuery);
  useEffect(() => {
    const t = setTimeout(() => {
      if (searchDraft !== filters.searchQuery) {
        onChange({ ...filters, searchQuery: searchDraft });
      }
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchDraft]);

  const setSourceType = (v: SourceTypeFilter) => onChange({ ...filters, sourceType: v });
  const setStatus = (v: StatusFilter) => onChange({ ...filters, status: v });
  const setCampaignId = (v: string) => onChange({ ...filters, campaignId: v });

  const toggleEfficiency = (v: EfficiencyFilter) => {
    const next = filters.efficiency.includes(v)
      ? filters.efficiency.filter(e => e !== v)
      : [...filters.efficiency, v];
    onChange({ ...filters, efficiency: next });
  };

  const summary = useMemo(() => {
    const parts: string[] = [];
    parts.push(
      filters.sourceType === 'all' ? '전체'
      : filters.sourceType === 'milwaukee' ? '밀워키'
      : filters.sourceType === 'general' ? '일반'
      : '미매칭'
    );
    parts.push(
      filters.status === 'all' ? '전체'
      : filters.status === 'on' ? 'ON'
      : 'OFF'
    );
    if (filters.campaignId !== 'all') {
      const c = campaigns.find(c => c.id === filters.campaignId);
      parts.push(c?.name ?? filters.campaignId);
    } else {
      parts.push('전체');
    }
    if (filters.efficiency.length > 0) {
      const map = { margin10: '마진 10%↑', margin20: '마진 20%↑', margin30: '마진 30%↑' };
      const lowest: EfficiencyFilter =
        filters.efficiency.includes('margin10') ? 'margin10'
        : filters.efficiency.includes('margin20') ? 'margin20'
        : 'margin30';
      parts.push(map[lowest]);
    }
    return parts.join(' · ');
  }, [filters, campaigns]);

  return (
    <div className="al-filter-wrap">
      <div className="al-filter-bar">
        <div className="al-card">
          <p className="al-label">구분</p>
          <div className="al-row">
            <Chip on={filters.sourceType === 'all'} onClick={() => setSourceType('all')}>
              전체 {counts.total}
            </Chip>
            <Chip on={filters.sourceType === 'milwaukee'} onClick={() => setSourceType('milwaukee')}>
              밀워키 {counts.milwaukee}
            </Chip>
            <Chip on={filters.sourceType === 'general'} onClick={() => setSourceType('general')}>
              일반 {counts.general}
            </Chip>
            <Chip on={filters.sourceType === 'unmatched'} onClick={() => setSourceType('unmatched')} warn>
              미매칭 {counts.unmatched}
            </Chip>
          </div>
        </div>

        <div className="al-card">
          <p className="al-label">상태</p>
          <div className="al-row">
            <Chip on={filters.status === 'all'} onClick={() => setStatus('all')}>전체</Chip>
            <Chip on={filters.status === 'on'} onClick={() => setStatus('on')}>ON {counts.on}</Chip>
            <Chip on={filters.status === 'off'} onClick={() => setStatus('off')}>OFF {counts.off}</Chip>
          </div>
        </div>

        <div className="al-card">
          <p className="al-label">캠페인</p>
          <div className="al-row">
            <Chip on={filters.campaignId === 'all'} onClick={() => setCampaignId('all')}>전체</Chip>
            {visibleCampaigns.map(c => (
              <Chip
                key={c.id}
                on={filters.campaignId === c.id}
                onClick={() => setCampaignId(c.id)}
              >
                {c.name}
              </Chip>
            ))}
            {hiddenCount > 0 && !showAllCampaigns && (
              <button
                type="button"
                className="al-chip al-chip-more"
                onClick={() => setShowAllCampaigns(true)}
              >
                ▾ +{hiddenCount}
              </button>
            )}
            {showAllCampaigns && campaigns.length > 3 && (
              <button
                type="button"
                className="al-chip al-chip-more"
                onClick={() => setShowAllCampaigns(false)}
              >
                ▴ 접기
              </button>
            )}
          </div>
        </div>

        <div className="al-card al-card-efficiency">
          <p className="al-label al-label-efficiency">◎ 효율</p>
          <div className="al-row">
            <span className="al-chip al-chip-dim" title="Step 6 통계 수집 후 활성화">
              🔒 손익분기
            </span>
            <Chip
              on={filters.efficiency.includes('margin10')}
              onClick={() => toggleEfficiency('margin10')}
            >
              {filters.efficiency.includes('margin10') ? '✓ ' : ''}마진 10%↑
            </Chip>
            <Chip
              on={filters.efficiency.includes('margin20')}
              onClick={() => toggleEfficiency('margin20')}
            >
              {filters.efficiency.includes('margin20') ? '✓ ' : ''}마진 20%↑
            </Chip>
            <Chip
              on={filters.efficiency.includes('margin30')}
              onClick={() => toggleEfficiency('margin30')}
            >
              {filters.efficiency.includes('margin30') ? '✓ ' : ''}마진 30%↑
            </Chip>
            <span
              className="al-chip al-chip-dim"
              title="Phase 3 자동 입찰 활성화 후 사용 — auto_bid_enabled = true인 광고만"
            >
              🔒 자동화
            </span>
          </div>
        </div>
      </div>

      <div className="al-search-bar">
        <div className="al-search-input-wrap">
          <span className="al-search-icon">🔍</span>
          <input
            type="text"
            placeholder="모델명·상품코드 검색"
            value={searchDraft}
            onChange={e => setSearchDraft(e.target.value)}
          />
        </div>
        <span className="al-summary">
          <span className="al-summary-active">{summary}</span>
          <span className="al-summary-arrow">→</span>
          <span className="al-summary-count">{filteredCount}건</span>
        </span>
      </div>

      <style>{`
        .al-filter-wrap { width: 100%; }
        .al-filter-bar { display: flex; flex-wrap: wrap; gap: 8px; }
        .al-card {
          background: #FFFFFF;
          border: 0.5px solid #D3D1C7;
          border-radius: 12px;
          padding: 8px 12px;
        }
        .al-card-efficiency { border-color: #BA7517; }
        .al-label {
          font-size: 11px;
          color: #6B6B6B;
          font-weight: 500;
          margin: 0 0 5px;
        }
        .al-label-efficiency { color: #854F0B; }
        .al-row {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          align-items: center;
        }
        .al-chip {
          font-size: 12px;
          padding: 5px 10px;
          border-radius: 14px;
          border: 0.5px solid #D3D1C7;
          background: #FFFFFF;
          color: #1A1D23;
          cursor: pointer;
          user-select: none;
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-family: inherit;
        }
        .al-chip:hover { border-color: #888780; }
        .al-chip-on {
          background: #185FA5;
          border-color: #0C447C;
          color: #FFFFFF;
          font-weight: 500;
        }
        .al-chip-warn { color: #791F1F; }
        .al-chip-dim {
          background: #F1EFE8;
          border-color: #D3D1C7;
          color: #888780;
          cursor: not-allowed;
        }
        .al-chip-more { color: #185FA5; }
        .al-search-bar {
          display: flex;
          align-items: center;
          gap: 12px;
          background: #FFFFFF;
          border: 0.5px solid #D3D1C7;
          border-radius: 12px;
          padding: 8px 12px;
          margin-top: 8px;
        }
        .al-search-input-wrap { flex: 1; position: relative; }
        .al-search-input-wrap input {
          width: 100%;
          padding: 6px 12px 6px 32px;
          font-size: 13px;
          height: 32px;
          border: 0.5px solid #D3D1C7;
          border-radius: 8px;
          box-sizing: border-box;
          outline: none;
          font-family: inherit;
        }
        .al-search-input-wrap input:focus { border-color: #185FA5; }
        .al-search-icon {
          position: absolute;
          left: 10px;
          top: 50%;
          transform: translateY(-50%);
          color: #888780;
          font-size: 14px;
        }
        .al-summary {
          font-size: 12px;
          color: #6B6B6B;
          white-space: nowrap;
        }
        .al-summary-active { color: #1A1D23; font-weight: 500; }
        .al-summary-arrow { margin: 0 6px; color: #888780; }
        .al-summary-count { color: #185FA5; font-weight: 500; }
      `}</style>
    </div>
  );
}

function Chip({
  on,
  warn,
  onClick,
  children,
}: {
  on: boolean;
  warn?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  const cls = `al-chip${on ? ' al-chip-on' : ''}${warn && !on ? ' al-chip-warn' : ''}`;
  return (
    <button type="button" className={cls} onClick={onClick}>
      {children}
    </button>
  );
}
