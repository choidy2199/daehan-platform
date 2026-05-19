'use client';

import { useEffect, useState } from 'react';
import type { ProductRow } from './types';
import { calcMargin } from './calcMargin';
import { useAdSimulator } from './useAdSimulator';
import {
  getUserPreference,
  setUserPreference,
} from '@/lib/userPreferences';

const PREF_KEY = 'adlab:simulator_defaults';
const DEFAULT_AD_COST_RATIO = 0.05;
const DEFAULT_TARGET_ROAS = 500;

interface SimulatorDefaults {
  adCostRatio: number;
  targetRoas: number;
}

function getLoginId(): string {
  if (typeof window === 'undefined') return 'anon';
  try {
    const raw = localStorage.getItem('current_user');
    if (!raw) return 'anon';
    const user = JSON.parse(raw);
    return user?.loginId ?? 'anon';
  } catch {
    return 'anon';
  }
}

function formatWon(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return value.toLocaleString() + '원';
}

interface ProductsDrawerProps {
  product: ProductRow | null;
  onClose: () => void;
  feeRate: number;
}

export function ProductsDrawer({ product, onClose, feeRate }: ProductsDrawerProps) {
  const [adCostRatio, setAdCostRatio] = useState<number>(DEFAULT_AD_COST_RATIO);
  const [targetRoas, setTargetRoas] = useState<number>(DEFAULT_TARGET_ROAS);

  useEffect(() => {
    const loginId = getLoginId();
    let cancelled = false;
    void (async () => {
      const saved = await getUserPreference<SimulatorDefaults>(loginId, PREF_KEY);
      if (cancelled || !saved) return;
      if (typeof saved.adCostRatio === 'number') setAdCostRatio(saved.adCostRatio);
      if (typeof saved.targetRoas === 'number') setTargetRoas(saved.targetRoas);
    })();
    return () => { cancelled = true; };
  }, []);

  const open = product !== null;
  const hasData =
    product != null &&
    product.priceNaver != null &&
    product.cost != null &&
    feeRate > 0;

  const margin = hasData
    ? calcMargin(product!.priceNaver!, product!.cost!, feeRate)
    : null;
  const marginRateDecimal = margin ? margin.rate / 100 : 0;

  const sim = useAdSimulator({
    sellingPrice: hasData ? product!.priceNaver! : 0,
    marginRate: marginRateDecimal,
    adCostRatio,
    targetRoas,
  });

  const reset = () => {
    setAdCostRatio(DEFAULT_AD_COST_RATIO);
    setTargetRoas(DEFAULT_TARGET_ROAS);
  };

  const save = async () => {
    const loginId = getLoginId();
    await setUserPreference<SimulatorDefaults>(loginId, PREF_KEY, {
      adCostRatio,
      targetRoas,
    });
    onClose();
  };

  return (
    <>
      <div
        className="al-drawer-overlay"
        data-open={open ? '1' : '0'}
        onClick={onClose}
      />
      <aside
        className="al-drawer"
        data-open={open ? '1' : '0'}
        aria-hidden={!open}
      >
        <div className="al-drawer-header">
          <h2 className="al-drawer-title">광고비 시뮬레이터</h2>
          <button
            type="button"
            className="al-drawer-close"
            onClick={onClose}
            aria-label="닫기"
          >
            ×
          </button>
        </div>

        <div className="al-drawer-body">
          <section className="al-drawer-info">
            <div className="al-drawer-info-name">
              {product?.matched ? (product?.model ?? '—') : '매칭 실패'}
            </div>
            <div className="al-drawer-info-meta">
              {product?.product_code ?? '—'} · {product?.category ?? '—'}
            </div>
          </section>

          <section className="al-drawer-metrics">
            <div className="al-metric">
              <div className="al-metric-label">판매가</div>
              <div className="al-metric-value">
                {hasData ? formatWon(product!.priceNaver) : '—'}
              </div>
            </div>
            <div className="al-metric">
              <div className="al-metric-label">마진율</div>
              <div className="al-metric-value">
                {margin ? margin.rate.toFixed(1) + '%' : '—'}
              </div>
            </div>
            <div className="al-metric">
              <div className="al-metric-label">마진액</div>
              <div className="al-metric-value">
                {margin ? formatWon(margin.profit) : '—'}
              </div>
            </div>
          </section>

          <section className="al-drawer-slider">
            <div className="al-slider-head">
              <label htmlFor="al-slider-adcost">광고비 비율 (마진 대비)</label>
              <span className="al-slider-value">
                {(adCostRatio * 100).toFixed(1)}%
              </span>
            </div>
            <input
              id="al-slider-adcost"
              type="range"
              min={0}
              max={0.3}
              step={0.001}
              value={adCostRatio}
              onChange={e => setAdCostRatio(parseFloat(e.target.value))}
            />
          </section>

          <section className="al-drawer-slider">
            <div className="al-slider-head">
              <label htmlFor="al-slider-roas">목표 ROAS</label>
              <span className="al-slider-value">{targetRoas}%</span>
            </div>
            <input
              id="al-slider-roas"
              type="range"
              min={200}
              max={1000}
              step={10}
              value={targetRoas}
              onChange={e => setTargetRoas(parseInt(e.target.value, 10))}
            />
          </section>

          <section className="al-drawer-results">
            <div className="al-metric">
              <div className="al-metric-label">권장 입찰가</div>
              <div className="al-metric-value">
                {hasData ? formatWon(sim.recommendedBid) : '—'}
              </div>
            </div>
            <div className="al-metric">
              <div className="al-metric-label">일 한도</div>
              <div className="al-metric-value">
                {hasData ? formatWon(sim.dailyBudget) : '—'}
              </div>
            </div>
            <div className="al-metric">
              <div className="al-metric-label">예상 일 매출</div>
              <div className="al-metric-value">
                {hasData ? formatWon(sim.expectedDailyRevenue) : '—'}
              </div>
            </div>
            <div className="al-metric">
              <div className="al-metric-label">예상 일 광고비</div>
              <div className="al-metric-value">
                {hasData ? formatWon(sim.expectedDailyAdCost) : '—'}
              </div>
            </div>
          </section>
        </div>

        <div className="al-drawer-footer">
          <button
            type="button"
            className="al-drawer-btn al-drawer-btn-disabled"
            disabled
          >
            NCC 광고 등록 (Step 5+)
          </button>
          <button
            type="button"
            className="al-drawer-btn al-drawer-btn-secondary"
            onClick={reset}
          >
            초기화
          </button>
          <button
            type="button"
            className="al-drawer-btn al-drawer-btn-primary"
            onClick={save}
          >
            설정 적용 (저장)
          </button>
        </div>
      </aside>

      <style>{`
        .al-drawer-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.3);
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.2s ease;
          z-index: 1000;
        }
        .al-drawer-overlay[data-open="1"] {
          opacity: 1;
          pointer-events: auto;
        }
        .al-drawer {
          position: fixed;
          top: 0;
          right: 0;
          height: 100vh;
          width: 480px;
          background: #FFFFFF;
          box-shadow: -2px 0 12px rgba(0, 0, 0, 0.12);
          transform: translateX(100%);
          transition: transform 0.25s ease;
          z-index: 1001;
          display: flex;
          flex-direction: column;
        }
        .al-drawer[data-open="1"] { transform: translateX(0); }

        .al-drawer-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 18px;
          background: #2C2C2A;
          color: #FFFFFF;
          flex-shrink: 0;
        }
        .al-drawer-title {
          margin: 0;
          font-size: 15px;
          font-weight: 600;
          color: #FFFFFF;
        }
        .al-drawer-close {
          background: transparent;
          border: none;
          color: #FFFFFF;
          font-size: 22px;
          line-height: 1;
          cursor: pointer;
          padding: 0 4px;
        }

        .al-drawer-body {
          flex: 1;
          overflow-y: auto;
          padding: 16px 18px;
          font-size: 13px;
          color: #1A1D23;
        }

        .al-drawer-info {
          padding: 10px 12px;
          border: 0.5px solid #E5E7EB;
          border-radius: 4px;
          background: #FAFAF8;
          margin-bottom: 14px;
        }
        .al-drawer-info-name {
          font-weight: 600;
          font-size: 14px;
          color: #1A1D23;
        }
        .al-drawer-info-meta {
          margin-top: 2px;
          font-size: 11px;
          color: #5F5E5A;
        }

        .al-drawer-metrics {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
          margin-bottom: 16px;
        }
        .al-drawer-results {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 8px;
          margin-top: 16px;
        }
        .al-metric {
          padding: 8px 10px;
          border: 0.5px solid #E5E7EB;
          border-radius: 4px;
          background: #FFFFFF;
        }
        .al-metric-label {
          font-size: 11px;
          color: #5F5E5A;
        }
        .al-metric-value {
          margin-top: 2px;
          font-size: 14px;
          font-weight: 600;
          color: #1A1D23;
          font-variant-numeric: tabular-nums;
        }

        .al-drawer-slider {
          margin-top: 14px;
        }
        .al-slider-head {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          margin-bottom: 6px;
        }
        .al-slider-head label {
          font-size: 12px;
          color: #374151;
          font-weight: 500;
        }
        .al-slider-value {
          font-size: 13px;
          font-weight: 600;
          color: #185FA5;
          font-variant-numeric: tabular-nums;
        }
        .al-drawer-slider input[type="range"] {
          width: 100%;
          accent-color: #185FA5;
        }

        .al-drawer-footer {
          display: flex;
          gap: 8px;
          padding: 12px 18px;
          border-top: 0.5px solid #E5E7EB;
          background: #FFFFFF;
          flex-shrink: 0;
        }
        .al-drawer-btn {
          flex: 1;
          padding: 8px 10px;
          border: 0.5px solid #D1D5DB;
          border-radius: 4px;
          background: #FFFFFF;
          color: #1A1D23;
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
          white-space: nowrap;
        }
        .al-drawer-btn-primary {
          background: #185FA5;
          color: #FFFFFF;
          border-color: #185FA5;
        }
        .al-drawer-btn-secondary {
          background: #FFFFFF;
          color: #374151;
        }
        .al-drawer-btn-disabled {
          background: #E5E7EB;
          color: #9CA3AF;
          border-color: #E5E7EB;
          cursor: not-allowed;
        }
      `}</style>
    </>
  );
}
