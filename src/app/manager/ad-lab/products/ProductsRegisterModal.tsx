'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ProductRow } from './types';
import { calcMargin } from './calcMargin';
import { useNccRegister } from './useNccRegister';
import type { NccRegisterKeyword } from './useNccRegister';

const DEFAULT_AD_COST_RATIO = 0.05;

interface ProductsRegisterModalProps {
  open: boolean;
  products: ProductRow[];
  feeRate: number;
  onClose: () => void;
}

type SortColumn = 'keyword' | 'volume' | 'comp' | 'ctr' | 'score';
type SortDirection = 'asc' | 'desc';
type CompLevel = '낮음' | '중간' | '높음';

const COMP_ORDER: Record<CompLevel, number> = { '낮음': 0, '중간': 1, '높음': 2 };
const DEFAULT_SORT_DIR: Record<SortColumn, SortDirection> = {
  keyword: 'asc', volume: 'desc', comp: 'asc', ctr: 'desc', score: 'desc',
};

function scoreBadgeTier(score: number): 'excellent' | 'normal' | 'poor' {
  if (score >= 7) return 'excellent';
  if (score >= 4) return 'normal';
  return 'poor';
}

function scoreBadgeLabel(score: number): string {
  if (score >= 7) return '우수';
  if (score >= 4) return '보통';
  return '부족';
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
  const [nccKeywords, setNccKeywords] = useState<NccRegisterKeyword[]>([]);
  const [selectedKeywords, setSelectedKeywords] = useState<Set<string>>(new Set());
  const [keywordsLoading, setKeywordsLoading] = useState(false);
  const [keywordsError, setKeywordsError] = useState<string | null>(null);
  const [sortColumn, setSortColumn] = useState<SortColumn>('score');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [compFilter, setCompFilter] = useState<Set<CompLevel>>(new Set(['낮음', '중간']));
  const [refetchToken, setRefetchToken] = useState(0);
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
    setIncludedIds(new Set(products.map(p => String(p.id))));
    setDryRun(true);
    setConfirmRealRun(false);
    resetResult();
  }, [open, products, resetResult]);

  useEffect(() => {
    if (!open) return;
    if (products.length === 0) {
      setNccKeywords([]);
      setSelectedKeywords(new Set());
      return;
    }
    let cancelled = false;
    setKeywordsLoading(true);
    setKeywordsError(null);

    fetch('/api/ad/extract-keywords', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        products: products.map(p => ({
          id: p.id,
          product_name: p.model,
          category: p.category,
        })),
      }),
    })
      .then(r => r.json())
      .then(data => {
        if (cancelled) return;
        if (!data.success) {
          setKeywordsError(data.error || '키워드 가져오기 실패');
          setNccKeywords([]);
          setSelectedKeywords(new Set());
          return;
        }
        const fetched: NccRegisterKeyword[] = data.keywords;
        setNccKeywords(fetched);
        const top10 = fetched
          .filter(k => k.compIdx === '낮음' || k.compIdx === '중간')
          .sort((a, b) =>
            b.recommendScore - a.recommendScore ||
            a.keyword.localeCompare(b.keyword, 'ko'),
          )
          .slice(0, 10)
          .map(k => k.keyword);
        setSelectedKeywords(new Set(top10));
      })
      .catch(err => {
        if (cancelled) return;
        setKeywordsError(String(err));
        setNccKeywords([]);
        setSelectedKeywords(new Set());
      })
      .finally(() => {
        if (cancelled) return;
        setKeywordsLoading(false);
      });

    return () => { cancelled = true; };
  }, [open, products, refetchToken]);

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

  const totalDailyBudget = useMemo(() => {
    const bidSum = includedProducts.reduce(
      (acc, p) => acc + (perMetrics.get(String(p.id))?.recommendedBid ?? 0),
      0,
    );
    return bidSum * selectedKeywords.size;
  }, [includedProducts, perMetrics, selectedKeywords]);

  const visibleKeywords = useMemo(() => {
    const filtered = nccKeywords.filter(k => compFilter.has(k.compIdx));
    const sorted = [...filtered].sort((a, b) => {
      let cmp = 0;
      switch (sortColumn) {
        case 'keyword': cmp = a.keyword.localeCompare(b.keyword, 'ko'); break;
        case 'volume': cmp = a.monthlySearchVolume - b.monthlySearchVolume; break;
        case 'comp': cmp = COMP_ORDER[a.compIdx] - COMP_ORDER[b.compIdx]; break;
        case 'ctr': cmp = a.clickRate - b.clickRate; break;
        case 'score': cmp = a.recommendScore - b.recommendScore; break;
      }
      if (cmp === 0) cmp = a.keyword.localeCompare(b.keyword, 'ko');
      return sortDirection === 'asc' ? cmp : -cmp;
    });
    return sorted;
  }, [nccKeywords, compFilter, sortColumn, sortDirection]);

  const selectedKwObjects = useMemo(
    () => nccKeywords.filter(k => selectedKeywords.has(k.keyword)),
    [nccKeywords, selectedKeywords],
  );

  const toggleIncluded = (id: string) => {
    setIncludedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleKeywordSelect = useCallback((keyword: string) => {
    setSelectedKeywords(prev => {
      const next = new Set(prev);
      if (next.has(keyword)) next.delete(keyword);
      else next.add(keyword);
      return next;
    });
  }, []);

  const handleSort = useCallback((col: SortColumn) => {
    setSortColumn(prev => {
      if (prev === col) {
        setSortDirection(d => d === 'asc' ? 'desc' : 'asc');
        return prev;
      }
      setSortDirection(DEFAULT_SORT_DIR[col]);
      return col;
    });
  }, []);

  const toggleCompFilter = useCallback((level: CompLevel) => {
    setCompFilter(prev => {
      const next = new Set(prev);
      if (next.has(level)) next.delete(level);
      else next.add(level);
      return next;
    });
  }, []);

  const reExtractKeywords = useCallback(() => {
    setRefetchToken(t => t + 1);
  }, []);

  const toggleHelp = (key: string) =>
    setHelpExpanded(prev => ({ ...prev, [key]: !prev[key] }));

  const toggleSection = (key: string) =>
    setSectionExpanded(prev => ({ ...prev, [key]: !prev[key] }));

  const doDryRun = useCallback(async () => {
    if (loading) return;
    try {
      await registerProducts(includedProducts, selectedKwObjects, true);
    } catch {
      /* error captured in hook */
    }
  }, [loading, registerProducts, includedProducts, selectedKwObjects]);

  const doRealRun = useCallback(async () => {
    if (loading) return;
    try {
      await registerProducts(includedProducts, selectedKwObjects, false);
    } catch {
      /* error captured in hook */
    } finally {
      setConfirmRealRun(false);
    }
  }, [loading, registerProducts, includedProducts, selectedKwObjects]);

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
              <span>키워드 (선택 {selectedKeywords.size} / 표시 {visibleKeywords.length})</span>
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
              <div className="al-rm-kw-section">
                <div className="al-rm-kw-controls">
                  <div className="al-rm-kw-chips">
                    <button
                      type="button"
                      className={`al-rm-kw-chip al-rm-kw-chip-low ${compFilter.has('낮음') ? 'is-active' : ''}`}
                      onClick={() => toggleCompFilter('낮음')}
                    >
                      {compFilter.has('낮음') ? '✓ ' : ''}낮음
                    </button>
                    <button
                      type="button"
                      className={`al-rm-kw-chip al-rm-kw-chip-mid ${compFilter.has('중간') ? 'is-active' : ''}`}
                      onClick={() => toggleCompFilter('중간')}
                    >
                      {compFilter.has('중간') ? '✓ ' : ''}중간
                    </button>
                    <button
                      type="button"
                      className={`al-rm-kw-chip al-rm-kw-chip-high ${compFilter.has('높음') ? 'is-active' : ''}`}
                      onClick={() => toggleCompFilter('높음')}
                    >
                      {compFilter.has('높음') ? '✓ ' : ''}높음
                    </button>
                  </div>
                  <button
                    type="button"
                    className="al-rm-kw-refetch"
                    onClick={reExtractKeywords}
                    disabled={keywordsLoading}
                  >
                    {keywordsLoading ? '가져오는 중…' : '키워드 다시 가져오기'}
                  </button>
                </div>

                {keywordsError && (
                  <div className="al-rm-kw-error">{keywordsError}</div>
                )}

                {keywordsLoading ? (
                  <div className="al-rm-kw-loading">키워드 가져오는 중…</div>
                ) : visibleKeywords.length === 0 ? (
                  <div className="al-rm-kw-empty">
                    {nccKeywords.length === 0 ? '키워드 없음' : '필터 조건에 맞는 키워드 없음'}
                  </div>
                ) : (
                  <table className="al-rm-kw-table">
                    <thead>
                      <tr>
                        <th className="al-rm-kw-th al-rm-kw-th-check"></th>
                        <th
                          className={`al-rm-kw-th ${sortColumn === 'keyword' ? 'is-sort-active' : ''}`}
                          onClick={() => handleSort('keyword')}
                        >
                          키워드 <span className="al-rm-kw-sort">{sortColumn === 'keyword' ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}</span>
                        </th>
                        <th
                          className={`al-rm-kw-th al-rm-kw-th-num ${sortColumn === 'volume' ? 'is-sort-active' : ''}`}
                          onClick={() => handleSort('volume')}
                        >
                          월 검색량 <span className="al-rm-kw-sort">{sortColumn === 'volume' ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}</span>
                        </th>
                        <th
                          className={`al-rm-kw-th ${sortColumn === 'comp' ? 'is-sort-active' : ''}`}
                          onClick={() => handleSort('comp')}
                        >
                          경쟁도 <span className="al-rm-kw-sort">{sortColumn === 'comp' ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}</span>
                        </th>
                        <th
                          className={`al-rm-kw-th al-rm-kw-th-num ${sortColumn === 'ctr' ? 'is-sort-active' : ''}`}
                          onClick={() => handleSort('ctr')}
                        >
                          클릭률 <span className="al-rm-kw-sort">{sortColumn === 'ctr' ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}</span>
                        </th>
                        <th
                          className={`al-rm-kw-th ${sortColumn === 'score' ? 'is-sort-active' : ''}`}
                          onClick={() => handleSort('score')}
                        >
                          추천 점수 <span className="al-rm-kw-sort">{sortColumn === 'score' ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleKeywords.map(k => {
                        const isSelected = selectedKeywords.has(k.keyword);
                        const tier = scoreBadgeTier(k.recommendScore);
                        const compClass = k.compIdx === '낮음' ? 'low' : k.compIdx === '중간' ? 'mid' : 'high';
                        return (
                          <tr
                            key={k.keyword}
                            className={`al-rm-kw-tr ${isSelected ? 'is-selected' : ''}`}
                            onClick={() => toggleKeywordSelect(k.keyword)}
                          >
                            <td className="al-rm-kw-td al-rm-kw-td-check">
                              <input type="checkbox" checked={isSelected} onChange={() => {}} readOnly />
                            </td>
                            <td className="al-rm-kw-td">{k.keyword}</td>
                            <td className="al-rm-kw-td al-rm-kw-td-num">{k.monthlySearchVolume.toLocaleString()}</td>
                            <td className="al-rm-kw-td">
                              <span className={`al-rm-kw-badge al-rm-kw-badge-comp-${compClass}`}>{k.compIdx}</span>
                            </td>
                            <td className="al-rm-kw-td al-rm-kw-td-num">{k.clickRate.toFixed(2)}%</td>
                            <td className="al-rm-kw-td">
                              <span className={`al-rm-kw-badge al-rm-kw-badge-score-${tier}`}>
                                {scoreBadgeLabel(k.recommendScore)} ({k.recommendScore})
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
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
                선택된 {includedProducts.length}개 상품 × {selectedKeywords.size}개 키워드를 실제 등록합니다.<br/>
                일 한도 합계: <strong>{formatWon(totalDailyBudget)}</strong>
                {totalDailyBudget > 50000 && (
                  <div className="al-rm-confirm-warn">⚠️ 50,000원을 초과합니다. 진행하시겠습니까?</div>
                )}
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

        .al-rm-kw-section { padding: 12px 20px 14px; }
        .al-rm-kw-controls {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }
        .al-rm-kw-chips { display: flex; gap: 8px; }
        .al-rm-kw-chip {
          height: 28px;
          padding: 0 14px;
          border-radius: 14px;
          font-size: 12.5px;
          font-weight: 500;
          border: 1px solid;
          background: #F8F7F2;
          cursor: pointer;
          transition: all .12s;
        }
        .al-rm-kw-chip-low { border-color: #27500A; color: #27500A; }
        .al-rm-kw-chip-mid { border-color: #854F0B; color: #854F0B; }
        .al-rm-kw-chip-high { border-color: #791F1F; color: #791F1F; }
        .al-rm-kw-chip.is-active.al-rm-kw-chip-low { background: #27500A; color: #FFFFFF; }
        .al-rm-kw-chip.is-active.al-rm-kw-chip-mid { background: #854F0B; color: #FFFFFF; }
        .al-rm-kw-chip.is-active.al-rm-kw-chip-high { background: #791F1F; color: #FFFFFF; }
        .al-rm-kw-refetch {
          height: 28px;
          padding: 0 14px;
          border-radius: 4px;
          border: 1px solid #C9C6BB;
          background: #FFFFFF;
          color: #2C2C2A;
          font-size: 12.5px;
          cursor: pointer;
        }
        .al-rm-kw-refetch:disabled { opacity: 0.5; cursor: not-allowed; }
        .al-rm-kw-error {
          padding: 8px 12px;
          background: #FCE8E8;
          color: #791F1F;
          border-radius: 4px;
          font-size: 12.5px;
          margin-bottom: 8px;
        }
        .al-rm-kw-loading, .al-rm-kw-empty {
          padding: 24px;
          text-align: center;
          color: #5F5E5A;
          font-size: 13px;
          background: #F8F7F2;
          border-radius: 4px;
        }
        .al-rm-kw-table {
          width: 100%;
          border-collapse: separate;
          border-spacing: 0;
          font-size: 13px;
        }
        .al-rm-kw-th {
          height: 32px;
          padding: 0 12px;
          text-align: left;
          background: #F1EFE8;
          color: #5F5E5A;
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
          user-select: none;
          border-bottom: 1px solid #DEE1E4;
        }
        .al-rm-kw-th-num { text-align: right; }
        .al-rm-kw-th-check { width: 36px; cursor: default; }
        .al-rm-kw-th.is-sort-active { background: #2C2C2A; color: #FFFFFF; }
        .al-rm-kw-sort { margin-left: 4px; font-size: 11px; opacity: 0.7; }
        .al-rm-kw-tr { cursor: pointer; transition: background .08s; }
        .al-rm-kw-tr:nth-child(even):not(.is-selected) { background: #F8F7F2; }
        .al-rm-kw-tr.is-selected { background: #E6F1FB; }
        .al-rm-kw-tr:hover:not(.is-selected) { background: #EFEDE5; }
        .al-rm-kw-td {
          height: 36px;
          padding: 0 12px;
          border-bottom: 1px solid #EDEAE0;
          vertical-align: middle;
        }
        .al-rm-kw-td-num { text-align: right; font-variant-numeric: tabular-nums; }
        .al-rm-kw-td-check { text-align: center; }
        .al-rm-kw-badge {
          display: inline-block;
          height: 22px;
          line-height: 22px;
          padding: 0 10px;
          border-radius: 11px;
          font-size: 11.5px;
          font-weight: 500;
        }
        .al-rm-kw-badge-comp-low { background: #DDEBC5; color: #27500A; }
        .al-rm-kw-badge-comp-mid { background: #F5E3C5; color: #854F0B; }
        .al-rm-kw-badge-comp-high { background: #F4D2D2; color: #791F1F; }
        .al-rm-kw-badge-score-excellent { background: #185FA5; color: #FFFFFF; }
        .al-rm-kw-badge-score-normal { background: #5F5E5A; color: #FFFFFF; }
        .al-rm-kw-badge-score-poor { background: #B4B2A9; color: #FFFFFF; }
        .al-rm-confirm-warn { margin-top: 8px; color: #791F1F; font-weight: 500; font-size: 13px; }

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
