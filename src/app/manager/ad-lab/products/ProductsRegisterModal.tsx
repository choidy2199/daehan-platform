'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ProductRow } from './types';
import { calcMargin } from './calcMargin';
import { extractKeywords } from '@/lib/extractKeywords';
import { useNccRegister } from './useNccRegister';

const DEFAULT_AD_COST_RATIO = 0.05;

interface ProductsRegisterModalProps {
  open: boolean;
  products: ProductRow[];
  feeRate: number;
  onClose: () => void;
}

type KeywordKind = 'brand' | 'product' | 'category';
interface TaggedKeyword {
  text: string;
  kind: KeywordKind;
}

function autoExtractAll(products: ProductRow[]): TaggedKeyword[] {
  const seen = new Set<string>();
  const out: TaggedKeyword[] = [];
  const push = (text: string, kind: KeywordKind) => {
    const t = text.trim();
    if (!t || seen.has(t)) return;
    seen.add(t);
    out.push({ text: t, kind });
  };
  for (const p of products) {
    const k = extractKeywords(p.model ?? '', p.category ?? '');
    k.brand.forEach(b => push(b, 'brand'));
    k.product.forEach(pr => push(pr, 'product'));
    k.category.forEach(c => push(c, 'category'));
  }
  return out;
}

function marginColorClass(rate: number | null): string {
  if (rate == null) return 'al-mg-low';
  if (rate < 10) return 'al-mg-low';
  if (rate < 25) return 'al-mg-mid';
  return 'al-mg-high';
}

function formatWon(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return value.toLocaleString() + '원';
}

interface PerProductMetrics {
  marginRate: number | null;
  marginAmount: number;
  recommendedBid: number;
  dailyBudget: number;
}

function computeMetrics(product: ProductRow, feeRate: number): PerProductMetrics {
  const m =
    product.priceNaver != null && product.cost != null
      ? calcMargin(product.priceNaver, product.cost, feeRate)
      : null;
  const marginRate = m ? m.rate : null;
  const marginRateDecimal = m ? m.rate / 100 : 0;
  const marginAmount = (product.priceNaver ?? 0) * marginRateDecimal;
  const recommendedBid = Math.round(marginAmount * DEFAULT_AD_COST_RATIO);
  const dailyBudget = Math.round(recommendedBid * 50);
  return { marginRate, marginAmount: Math.round(marginAmount), recommendedBid, dailyBudget };
}

export function ProductsRegisterModal({
  open,
  products,
  feeRate,
  onClose,
}: ProductsRegisterModalProps) {
  const [keywords, setKeywords] = useState<TaggedKeyword[]>([]);
  const [keywordInput, setKeywordInput] = useState('');
  const [dryRun, setDryRun] = useState(true);
  const [helpExpanded, setHelpExpanded] = useState<Record<string, boolean>>({});
  const [sectionExpanded, setSectionExpanded] = useState<Record<string, boolean>>({
    target: true,
    keywords: true,
    group: true,
    mode: true,
  });
  const [confirmRealRun, setConfirmRealRun] = useState(false);
  const [includedIds, setIncludedIds] = useState<Set<string>>(new Set());

  const { loading, error, result, registerProducts, resetResult } = useNccRegister(feeRate);

  useEffect(() => {
    if (!open) return;
    const auto = autoExtractAll(products);
    setKeywords(auto);
    setIncludedIds(new Set(products.map(p => String(p.id))));
    setDryRun(true);
    setKeywordInput('');
    setConfirmRealRun(false);
    resetResult();
  }, [open, products, resetResult]);

  const includedProducts = useMemo(
    () => products.filter(p => includedIds.has(String(p.id))),
    [products, includedIds],
  );

  const perMetrics = useMemo(() => {
    const map = new Map<string, PerProductMetrics>();
    for (const p of products) map.set(String(p.id), computeMetrics(p, feeRate));
    return map;
  }, [products, feeRate]);

  const avgBid = useMemo(() => {
    if (includedProducts.length === 0) return 0;
    const sum = includedProducts.reduce(
      (acc, p) => acc + (perMetrics.get(String(p.id))?.recommendedBid ?? 0),
      0,
    );
    return Math.round(sum / includedProducts.length);
  }, [includedProducts, perMetrics]);

  const totalDailyBudget = useMemo(
    () =>
      includedProducts.reduce(
        (acc, p) => acc + (perMetrics.get(String(p.id))?.dailyBudget ?? 0),
        0,
      ),
    [includedProducts, perMetrics],
  );

  const toggleIncluded = (id: string) => {
    setIncludedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const removeKeyword = (text: string) =>
    setKeywords(prev => prev.filter(k => k.text !== text));

  const addKeyword = () => {
    const t = keywordInput.trim();
    if (!t) return;
    if (keywords.some(k => k.text === t)) {
      setKeywordInput('');
      return;
    }
    setKeywords(prev => [...prev, { text: t, kind: 'product' }]);
    setKeywordInput('');
  };

  const reExtract = () => {
    const auto = autoExtractAll(products);
    setKeywords(auto);
  };

  const toggleHelp = (key: string) =>
    setHelpExpanded(prev => ({ ...prev, [key]: !prev[key] }));

  const toggleSection = (key: string) =>
    setSectionExpanded(prev => ({ ...prev, [key]: !prev[key] }));

  const doDryRun = useCallback(async () => {
    if (loading) return;
    try {
      await registerProducts(includedProducts, keywords.map(k => k.text), true);
    } catch {
      /* error captured in hook */
    }
  }, [loading, registerProducts, includedProducts, keywords]);

  const doRealRun = useCallback(async () => {
    if (loading) return;
    try {
      await registerProducts(includedProducts, keywords.map(k => k.text), false);
    } catch {
      /* error captured in hook */
    } finally {
      setConfirmRealRun(false);
    }
  }, [loading, registerProducts, includedProducts, keywords]);

  const handleOverlayClick = () => {
    if (loading) return;
    onClose();
  };

  if (!open) return null;

  return (
    <>
      <div className="al-rm-overlay" onClick={handleOverlayClick} />
      <div className="al-rm-modal" role="dialog" aria-modal="true">
        <div className="al-rm-header">
          <h2 className="al-rm-title">NCC 광고 등록</h2>
          <button
            type="button"
            className="al-rm-close"
            onClick={onClose}
            disabled={loading}
            aria-label="닫기"
          >
            ×
          </button>
        </div>

        <div className="al-rm-body">
          {/* Section 1: 등록 대상 */}
          <section className="al-rm-section">
            <button
              type="button"
              className="al-rm-section-head"
              onClick={() => toggleSection('target')}
            >
              <span>등록 대상 ({includedProducts.length} / {products.length})</span>
              <span className="al-rm-caret">{sectionExpanded.target ? '▾' : '▸'}</span>
            </button>
            <div className="al-rm-help">
              <span className="al-rm-help-icon">?</span>
              <span className="al-rm-help-short">
                체크박스로 등록 직전에 일부 상품을 제외할 수 있습니다.
              </span>
              <button
                type="button"
                className="al-rm-help-toggle"
                onClick={() => toggleHelp('target')}
              >
                {helpExpanded.target ? '접기' : '더 알아보기'}
              </button>
            </div>
            {helpExpanded.target && (
              <div className="al-rm-help-detail">
                각 상품의 권장 입찰가는 마진액의 5%로 계산됩니다.
                마진율이 낮은 상품은 제외하는 것을 권장합니다.
              </div>
            )}
            {sectionExpanded.target && (
              <div className="al-rm-target-list">
                {products.map(p => {
                  const id = String(p.id);
                  const m = perMetrics.get(id);
                  return (
                    <div key={id} className="al-rm-target-row">
                      <input
                        type="checkbox"
                        checked={includedIds.has(id)}
                        onChange={() => toggleIncluded(id)}
                        disabled={loading}
                      />
                      <div className="al-rm-target-name">
                        <div className="al-rm-target-model">{p.model ?? '—'}</div>
                        <div className="al-rm-target-code">{p.product_code ?? '—'}</div>
                      </div>
                      <div className="al-rm-target-price">{formatWon(p.priceNaver)}</div>
                      <div className={`al-rm-mg ${marginColorClass(m?.marginRate ?? null)}`}>
                        {m?.marginRate != null ? m.marginRate.toFixed(1) + '%' : '—'}
                      </div>
                      <div className="al-rm-target-bid">{formatWon(m?.recommendedBid)}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Section 2: 키워드 */}
          <section className="al-rm-section">
            <button
              type="button"
              className="al-rm-section-head"
              onClick={() => toggleSection('keywords')}
            >
              <span>키워드 ({keywords.length})</span>
              <span className="al-rm-caret">{sectionExpanded.keywords ? '▾' : '▸'}</span>
            </button>
            <div className="al-rm-help">
              <span className="al-rm-help-icon">?</span>
              <span className="al-rm-help-short">
                상품명과 카테고리에서 자동 추출한 키워드입니다.
              </span>
              <button
                type="button"
                className="al-rm-help-toggle"
                onClick={() => toggleHelp('keywords')}
              >
                {helpExpanded.keywords ? '접기' : '더 알아보기'}
              </button>
            </div>
            {helpExpanded.keywords && (
              <div className="al-rm-help-detail">
                파란색 태그는 product, 앰버색 태그는 category 분류입니다.
                × 버튼으로 개별 삭제 가능하며, 하단 입력에 새 키워드를 추가할 수 있습니다.
              </div>
            )}
            {sectionExpanded.keywords && (
              <>
                <div className="al-rm-kw-list">
                  {keywords.map(k => (
                    <span key={k.text} className={`al-rm-kw al-rm-kw-${k.kind}`}>
                      {k.text}
                      <button
                        type="button"
                        className="al-rm-kw-del"
                        onClick={() => removeKeyword(k.text)}
                        disabled={loading}
                        aria-label="삭제"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
                <div className="al-rm-kw-row">
                  <input
                    type="text"
                    className="al-rm-kw-input"
                    value={keywordInput}
                    onChange={e => setKeywordInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addKeyword();
                      }
                    }}
                    placeholder="새 키워드 입력 후 Enter"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    className="al-rm-kw-btn"
                    onClick={reExtract}
                    disabled={loading}
                  >
                    키워드 다시 추출
                  </button>
                </div>
              </>
            )}
          </section>

          {/* Section 3: 상품그룹 및 입찰가 */}
          <section className="al-rm-section">
            <button
              type="button"
              className="al-rm-section-head"
              onClick={() => toggleSection('group')}
            >
              <span>상품그룹 및 입찰가 정보</span>
              <span className="al-rm-caret">{sectionExpanded.group ? '▾' : '▸'}</span>
            </button>
            <div className="al-rm-help">
              <span className="al-rm-help-icon">?</span>
              <span className="al-rm-help-short">
                환경변수 NAVER_AD_GROUP_ID에 사전 등록된 상품그룹에 광고를 등록합니다.
              </span>
              <button
                type="button"
                className="al-rm-help-toggle"
                onClick={() => toggleHelp('group')}
              >
                {helpExpanded.group ? '접기' : '더 알아보기'}
              </button>
            </div>
            {helpExpanded.group && (
              <div className="al-rm-help-detail">
                상품그룹은 네이버 광고 관리 사이트에서 1회 수동 생성 후 ID를 환경변수에 등록합니다.
                평균 입찰가는 포함 상품들의 권장 입찰가 평균이며,
                일 한도 합계는 각 상품 일 한도의 총합입니다.
              </div>
            )}
            {sectionExpanded.group && (
              <div className="al-rm-group-info">
                <div className="al-rm-group-left">
                  <div className="al-rm-info-label">상품그룹</div>
                  <div className="al-rm-info-value">환경변수 NAVER_AD_GROUP_ID 사용</div>
                </div>
                <div className="al-rm-group-right">
                  <div className="al-rm-info-cell">
                    <div className="al-rm-info-label">평균 입찰가</div>
                    <div className="al-rm-info-value">{formatWon(avgBid)}</div>
                  </div>
                  <div className="al-rm-info-cell">
                    <div className="al-rm-info-label">일 한도 합계</div>
                    <div className="al-rm-info-value">{formatWon(totalDailyBudget)}</div>
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* Section 4: 등록 모드 */}
          <section className="al-rm-section">
            <button
              type="button"
              className="al-rm-section-head"
              onClick={() => toggleSection('mode')}
            >
              <span>등록 모드</span>
              <span className="al-rm-caret">{sectionExpanded.mode ? '▾' : '▸'}</span>
            </button>
            <div className="al-rm-help">
              <span className="al-rm-help-icon">?</span>
              <span className="al-rm-help-short">
                dry-run 모드는 NCC API를 호출하지 않고 시뮬레이션만 수행합니다.
              </span>
              <button
                type="button"
                className="al-rm-help-toggle"
                onClick={() => toggleHelp('mode')}
              >
                {helpExpanded.mode ? '접기' : '더 알아보기'}
              </button>
            </div>
            {helpExpanded.mode && (
              <div className="al-rm-help-detail">
                dry-run ON: 데이터베이스에 쓰지 않고 등록될 결과만 미리 확인합니다.
                dry-run OFF: 실제 NCC API를 호출하여 광고가 등록되며 되돌릴 수 없습니다.
              </div>
            )}
            {sectionExpanded.mode && (
              <div className="al-rm-mode-row">
                <label className="al-rm-toggle">
                  <input
                    type="checkbox"
                    checked={dryRun}
                    onChange={e => setDryRun(e.target.checked)}
                    disabled={loading}
                  />
                  <span>dry-run 모드 {dryRun ? 'ON' : 'OFF'}</span>
                </label>
              </div>
            )}
          </section>

          {/* 결과 패널 */}
          {error && (
            <div className="al-rm-error">에러: {error}</div>
          )}
          {result && (
            <div className="al-rm-result">
              <div className="al-rm-result-head">
                {result.dry_run ? 'dry-run 결과' : '등록 결과'}
                <span className="al-rm-result-summary">
                  {' · 등록 시도 '}{result.registered.length}건
                  {' · 성공 '}{result.registered.filter(r => r.status === 'success' || r.status === 'dry_run').length}건
                  {' · 실패 '}{result.registered.filter(r => r.status === 'failed').length}건
                </span>
              </div>
              <div className="al-rm-result-table">
                {result.registered.map(r => (
                  <div key={r.product_id} className="al-rm-result-row">
                    <span className="al-rm-result-pid">{r.product_id}</span>
                    <span className={`al-rm-result-st al-rm-result-st-${r.status}`}>
                      {r.status === 'success' ? '성공'
                        : r.status === 'failed' ? '실패'
                        : 'dry-run'}
                    </span>
                    <span className="al-rm-result-msg">
                      {r.status === 'failed'
                        ? (r.error_message ?? '에러')
                        : r.ncc_campaign_id ?? '—'}
                    </span>
                  </div>
                ))}
              </div>
              <div className="al-rm-result-footer">
                <button
                  type="button"
                  className="al-rm-btn al-rm-btn-primary"
                  onClick={onClose}
                >
                  닫기
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="al-rm-footer">
          <button
            type="button"
            className="al-rm-btn al-rm-btn-secondary"
            onClick={onClose}
            disabled={loading}
          >
            취소
          </button>
          <button
            type="button"
            className="al-rm-btn al-rm-btn-primary"
            onClick={doDryRun}
            disabled={loading || !dryRun || includedProducts.length === 0}
          >
            {loading && dryRun ? '실행 중...' : 'dry-run 실행'}
          </button>
          <button
            type="button"
            className="al-rm-btn al-rm-btn-danger"
            onClick={() => setConfirmRealRun(true)}
            disabled={loading || dryRun || includedProducts.length === 0}
          >
            실제 등록
          </button>
        </div>

        {confirmRealRun && (
          <div className="al-rm-confirm">
            <div className="al-rm-confirm-box">
              <div className="al-rm-confirm-title">실제 등록 확인</div>
              <div className="al-rm-confirm-msg">
                {includedProducts.length}개 상품을 NCC에 실제 등록합니다.
                되돌릴 수 없습니다. 계속하시겠습니까?
              </div>
              <div className="al-rm-confirm-btns">
                <button
                  type="button"
                  className="al-rm-btn al-rm-btn-secondary"
                  onClick={() => setConfirmRealRun(false)}
                  disabled={loading}
                >
                  취소
                </button>
                <button
                  type="button"
                  className="al-rm-btn al-rm-btn-danger"
                  onClick={doRealRun}
                  disabled={loading}
                >
                  {loading ? '등록 중...' : '확인'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <style>{`
        .al-rm-overlay {
          position: fixed; inset: 0; background: rgba(0,0,0,0.45);
          z-index: 1500;
        }
        .al-rm-modal {
          position: fixed; top: 50%; left: 50%;
          transform: translate(-50%, -50%);
          width: 880px; max-width: 95vw; max-height: 92vh;
          background: #FFFFFF; border-radius: 6px;
          box-shadow: 0 12px 40px rgba(0,0,0,0.25);
          z-index: 1501; display: flex; flex-direction: column;
          font-size: 13px; color: #1A1D23;
        }
        .al-rm-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 14px 20px; background: #2C2C2A; color: #FFFFFF;
          border-radius: 6px 6px 0 0;
        }
        .al-rm-title { margin: 0; font-size: 16px; font-weight: 600; color: #FFFFFF; }
        .al-rm-close {
          background: transparent; border: none; color: #FFFFFF;
          font-size: 22px; line-height: 1; cursor: pointer; padding: 0 4px;
        }
        .al-rm-close:disabled { opacity: 0.4; cursor: not-allowed; }
        .al-rm-body { flex: 1; overflow-y: auto; padding: 0; }

        .al-rm-section { border-bottom: 0.5px solid #E5E7EB; }
        .al-rm-section:last-child { border-bottom: none; }
        .al-rm-section-head {
          width: 100%; display: flex; align-items: center; justify-content: space-between;
          padding: 10px 20px; background: #2C2C2A; color: #FFFFFF;
          border: none; cursor: pointer; font-size: 13px; font-weight: 600;
          text-align: left;
        }
        .al-rm-caret { color: #FFFFFF; font-size: 12px; }

        .al-rm-help {
          display: flex; align-items: center; gap: 8px;
          padding: 8px 20px; background: #F1EFE8;
          font-size: 12px; color: #374151;
        }
        .al-rm-help-icon {
          display: inline-flex; align-items: center; justify-content: center;
          width: 16px; height: 16px; border-radius: 50%;
          background: #185FA5; color: #FFFFFF; font-size: 11px; font-weight: 700;
          flex-shrink: 0;
        }
        .al-rm-help-short { flex: 1; }
        .al-rm-help-toggle {
          background: transparent; border: none; color: #185FA5;
          font-size: 12px; cursor: pointer; padding: 0; white-space: nowrap;
        }
        .al-rm-help-detail {
          padding: 8px 20px 10px 44px; background: #F1EFE8;
          font-size: 12px; color: #5F5E5A; line-height: 1.5;
          border-top: 0.5px dashed #D6D2C4;
        }

        .al-rm-target-list { padding: 8px 20px 12px; }
        .al-rm-target-row {
          display: grid;
          grid-template-columns: 20px 1fr 100px 70px 100px;
          gap: 10px; align-items: center;
          padding: 6px 0; border-bottom: 0.5px solid #F3F4F6;
        }
        .al-rm-target-row:last-child { border-bottom: none; }
        .al-rm-target-model { color: #1A1D23; font-weight: 500; }
        .al-rm-target-code { color: #5F5E5A; font-size: 11px; margin-top: 2px; }
        .al-rm-target-price {
          text-align: right; font-variant-numeric: tabular-nums; color: #1A1D23;
        }
        .al-rm-mg {
          text-align: right; font-variant-numeric: tabular-nums;
          font-weight: 500; padding: 2px 6px; border-radius: 3px;
        }
        .al-mg-low { color: #791F1F; background: #FCEBEB; }
        .al-mg-mid { color: #854F0B; background: #FDF6E3; }
        .al-mg-high { color: #27500A; background: #E5F0D8; }
        .al-rm-target-bid {
          text-align: right; font-variant-numeric: tabular-nums;
          color: #3C3489; font-weight: 500;
        }

        .al-rm-kw-list {
          display: flex; flex-wrap: wrap; gap: 6px;
          padding: 10px 20px 4px;
        }
        .al-rm-kw {
          display: inline-flex; align-items: center; gap: 4px;
          padding: 3px 8px; border-radius: 12px; font-size: 12px;
        }
        .al-rm-kw-brand { background: #E5F0D8; color: #27500A; }
        .al-rm-kw-product { background: #DCE9F5; color: #185FA5; }
        .al-rm-kw-category { background: #FDF6E3; color: #854F0B; }
        .al-rm-kw-del {
          background: transparent; border: none; color: inherit;
          cursor: pointer; padding: 0; font-size: 14px; line-height: 1;
        }
        .al-rm-kw-row {
          display: flex; gap: 8px; padding: 6px 20px 12px;
        }
        .al-rm-kw-input {
          flex: 1; padding: 6px 10px; border: 0.5px solid #D1D5DB;
          border-radius: 4px; font-size: 13px; background: #FFFFFF;
        }
        .al-rm-kw-btn {
          padding: 6px 12px; border: 0.5px solid #D1D5DB; border-radius: 4px;
          background: #FFFFFF; color: #1A1D23; font-size: 12px; cursor: pointer;
          white-space: nowrap;
        }

        .al-rm-group-info {
          display: grid; grid-template-columns: 1fr auto; gap: 16px;
          padding: 10px 20px 14px; align-items: center;
        }
        .al-rm-group-right { display: flex; gap: 16px; }
        .al-rm-info-cell { text-align: right; }
        .al-rm-info-label { font-size: 11px; color: #5F5E5A; }
        .al-rm-info-value {
          margin-top: 2px; font-size: 14px; font-weight: 600; color: #1A1D23;
          font-variant-numeric: tabular-nums;
        }

        .al-rm-mode-row { padding: 10px 20px 14px; }
        .al-rm-toggle {
          display: inline-flex; align-items: center; gap: 8px;
          cursor: pointer; font-size: 13px;
        }

        .al-rm-error {
          margin: 10px 20px; padding: 8px 12px;
          background: #FCEBEB; color: #791F1F; border-radius: 4px; font-size: 12px;
        }
        .al-rm-result {
          margin: 0 20px 12px; border: 0.5px solid #E5E7EB; border-radius: 4px;
          background: #FAFAF8;
        }
        .al-rm-result-head {
          padding: 8px 12px; background: #2C2C2A; color: #FFFFFF;
          border-radius: 4px 4px 0 0; font-size: 12px; font-weight: 600;
        }
        .al-rm-result-summary { font-weight: 400; color: #E5E7EB; }
        .al-rm-result-table { max-height: 200px; overflow-y: auto; }
        .al-rm-result-row {
          display: grid; grid-template-columns: 100px 70px 1fr;
          gap: 8px; padding: 6px 12px; font-size: 12px;
          border-bottom: 0.5px solid #F3F4F6;
        }
        .al-rm-result-pid { color: #5F5E5A; }
        .al-rm-result-st {
          text-align: center; font-weight: 500; padding: 1px 6px; border-radius: 3px;
        }
        .al-rm-result-st-success { background: #E5F0D8; color: #27500A; }
        .al-rm-result-st-failed { background: #FCEBEB; color: #791F1F; }
        .al-rm-result-st-dry_run { background: #DCE9F5; color: #185FA5; }
        .al-rm-result-msg { color: #1A1D23; overflow-wrap: anywhere; }
        .al-rm-result-footer {
          padding: 8px 12px; display: flex; justify-content: flex-end;
        }

        .al-rm-footer {
          display: flex; gap: 8px; justify-content: flex-end;
          padding: 12px 20px; border-top: 0.5px solid #E5E7EB;
          background: #FFFFFF; border-radius: 0 0 6px 6px;
        }
        .al-rm-btn {
          padding: 8px 14px; border: 0.5px solid #D1D5DB; border-radius: 4px;
          background: #FFFFFF; color: #1A1D23; font-size: 13px; font-weight: 500;
          cursor: pointer; white-space: nowrap;
        }
        .al-rm-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .al-rm-btn-primary { background: #185FA5; color: #FFFFFF; border-color: #185FA5; }
        .al-rm-btn-danger { background: #A32D2D; color: #FFFFFF; border-color: #A32D2D; }
        .al-rm-btn-secondary { background: #FFFFFF; color: #374151; }

        .al-rm-confirm {
          position: fixed; inset: 0; z-index: 1600;
          display: flex; align-items: center; justify-content: center;
          background: rgba(0,0,0,0.55);
        }
        .al-rm-confirm-box {
          background: #FFFFFF; border-radius: 6px;
          padding: 20px 24px; width: 400px; max-width: 90vw;
          box-shadow: 0 8px 24px rgba(0,0,0,0.3);
        }
        .al-rm-confirm-title { font-size: 15px; font-weight: 600; color: #1A1D23; }
        .al-rm-confirm-msg {
          margin-top: 10px; font-size: 13px; color: #374151; line-height: 1.5;
        }
        .al-rm-confirm-btns {
          margin-top: 16px; display: flex; gap: 8px; justify-content: flex-end;
        }
      `}</style>
    </>
  );
}
