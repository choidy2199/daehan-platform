'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { CSSProperties } from 'react';
import { Package } from 'lucide-react';
import { PricingTable, type PricingRow } from './components/PricingTable';
import type { ChannelFeeRates } from './lib/feeCalc';
import { COLUMNS } from './lib/columnConfig';
import { useColumnConfig } from './lib/useColumnConfig';
import { ColumnSettingsModal } from './components/ColumnSettingsModal';
import { ImportModal } from './components/ImportModal';
import { DeleteConfirmDialog } from './components/DeleteConfirmDialog';
import { supabase } from '@/lib/supabase';

// ============================================================
// 내부 타입
// ============================================================

interface ImportPricingItem {
  id: number;
  gen_product_id: number | null;
  custom_code: string | null;
  custom_manage_code: string | null;
  custom_category: string | null;
  custom_model: string | null;
  custom_spec: string | null;
  cost: number | null;
  price_a: number | null;
  price_b: number | null;
  price_c: number | null;
  price_naver: number | null;
  price_coupang: number | null;
  price_gmarket: number | null;
  price_ssg: number | null;
  override_category: string | null;
}

export interface DraftRow {
  custom_code: string;
  custom_manage_code: string;
  custom_category: string;
  custom_model: string;
  custom_spec: string;
  cost: number | null;
  override_category: 'powertool' | 'handtool' | null;
  price_a: number | null;
  price_b: number | null;
  price_c: number | null;
  price_naver: number | null;
  price_coupang: number | null;
  price_gmarket: number | null;
  price_ssg: number | null;
}

// ============================================================
// 매핑 함수
// ============================================================

function mapChannelFees(raw: any): ChannelFeeRates | null {
  if (!raw?.channels) return null;
  const ch = raw.channels;
  try {
    return {
      naver:       (ch.naver.fees[0].rate + ch.naver.fees[1].rate) / 100,
      coupang_mp:  { powertool: ch.coupang_mp.categories[0].rate / 100, handtool: ch.coupang_mp.categories[1].rate / 100 },
      gmarket:     { powertool: ch.gmarket.categories[0].rate / 100,    handtool: ch.gmarket.categories[1].rate / 100    },
      ssg:         ch.ssg.categories[0].rate / 100,
    };
  } catch {
    return null;
  }
}

function buildRows(items: ImportPricingItem[], genMap: Map<number, any>): PricingRow[] {
  return items.map(item => {
    const gen = item.gen_product_id != null ? genMap.get(item.gen_product_id) : null;
    return {
      id:               item.id,
      genProductId:     item.gen_product_id,
      imgUrl:           null,
      code:             gen?.code              ?? item.custom_code          ?? '',
      manageCode:       gen?.manageCode        ?? item.custom_manage_code   ?? '',
      category:         gen?.category          ?? item.custom_category      ?? '',
      model:            gen?.model             ?? item.custom_model         ?? '',
      spec:             gen?.description       ?? item.custom_spec          ?? '',
      stock:            gen?.stock             ?? 0,
      cost:             item.cost              ?? gen?.cost                 ?? 0,
      priceA:           item.price_a           ?? 0,
      priceB:           item.price_b           ?? 0,
      priceC:           item.price_c           ?? 0,
      priceNaver:       item.price_naver       ?? 0,
      priceCoupang:     item.price_coupang     ?? 0,
      priceGmarket:     item.price_gmarket     ?? 0,
      priceSsg:         item.price_ssg         ?? 0,
      inQty:            gen?.inQty             ?? 0,
      outQty:           gen?.outQty            ?? 0,
      pallet:           gen?.palletQty         ?? 0,
      overrideCategory: (item.override_category as 'powertool' | 'handtool' | null) ?? null,
    };
  });
}

// ============================================================
// 메인 페이지
// ============================================================

type LoadState = 'loading' | 'ready' | 'error';

export default function ImportPricingPage() {
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [errorMsg, setErrorMsg]   = useState<string>('');
  const [rows, setRows]           = useState<PricingRow[]>([]);
  const [rates, setRates]         = useState<ChannelFeeRates | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [items, setItems] = useState<ImportPricingItem[]>([]);
  const [draftRow, setDraftRow] = useState<DraftRow | null>(null);
  const [draftErrors, setDraftErrors] = useState<Set<string>>(new Set());
  const [deleteMode, setDeleteMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const { config, save, reset } = useColumnConfig();
  const resolvedCols = config.order
    .map(id => COLUMNS.find(c => c.id === id))
    .filter((c): c is NonNullable<typeof c> => c != null);

  const existingGenProductIds = useMemo(
    () => new Set(items.map(it => String(it.gen_product_id)).filter(Boolean)),
    [items]
  );

  const fetchItems = useCallback(async () => {
    let cancelled = false;
    try {
      const [feesRes, productsRes, itemsRes] = await Promise.all([
        supabase.from('app_data').select('value').eq('key', 'mw_channel_fees').single(),
        supabase.from('app_data').select('value').eq('key', 'mw_gen_products').single(),
        supabase.from('import_pricing_items').select('*').order('id', { ascending: false }),
      ]);

      if (cancelled) return;

      if (feesRes.error)    throw new Error('수수료 정보 로드 실패');
      if (productsRes.error) throw new Error('제품 마스터 로드 실패');
      if (itemsRes.error)   throw new Error('책정 데이터 로드 실패');

      const mappedRates = mapChannelFees(feesRes.data?.value);
      if (!mappedRates) throw new Error('수수료 구조 파싱 실패');

      const genProductsArray = (productsRes.data?.value ?? []) as any[];
      const genMap = new Map<number, any>();
      for (const p of genProductsArray) {
        if (p.code != null) genMap.set(parseInt(p.code, 10), p);
      }

      const fetchedItems = (itemsRes.data ?? []) as ImportPricingItem[];
      const builtRows = buildRows(fetchedItems, genMap);

      setItems(fetchedItems);
      setRates(mappedRates);
      setRows(builtRows);
      setLoadState('ready');
    } catch (e: any) {
      if (cancelled) return;
      setErrorMsg(e?.message ?? '알 수 없는 에러');
      setLoadState('error');
    }
  }, []);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const handleAddRow = useCallback(() => {
    if (draftRow) return;
    setDraftRow({
      custom_code: '',
      custom_manage_code: '',
      custom_category: '',
      custom_model: '',
      custom_spec: '',
      cost: null,
      override_category: null,
      price_a: null,
      price_b: null,
      price_c: null,
      price_naver: null,
      price_coupang: null,
      price_gmarket: null,
      price_ssg: null,
    });
    setDraftErrors(new Set());
  }, [draftRow]);

  const handleDraftChange = useCallback((field: keyof DraftRow, value: any) => {
    setDraftRow(prev => prev ? { ...prev, [field]: value } : prev);
    setDraftErrors(prev => {
      const next = new Set(prev);
      next.delete(field);
      return next;
    });
  }, []);

  const handleDraftCancel = useCallback(() => {
    setDraftRow(null);
    setDraftErrors(new Set());
  }, []);

  const handleDraftSave = useCallback(async () => {
    if (!draftRow) return;

    const errors = new Set<string>();
    if (!draftRow.custom_model.trim()) errors.add('custom_model');
    if (!draftRow.custom_spec.trim()) errors.add('custom_spec');
    if (draftRow.cost === null || draftRow.cost <= 0) errors.add('cost');
    if (!draftRow.override_category) errors.add('override_category');

    if (errors.size > 0) {
      setDraftErrors(errors);
      return;
    }

    const payload = {
      gen_product_id: null,
      custom_code: draftRow.custom_code.trim() || null,
      custom_manage_code: draftRow.custom_manage_code.trim() || null,
      custom_category: draftRow.custom_category.trim() || null,
      custom_model: draftRow.custom_model.trim(),
      custom_spec: draftRow.custom_spec.trim(),
      cost: draftRow.cost,
      override_category: draftRow.override_category,
      price_a: draftRow.price_a,
      price_b: draftRow.price_b,
      price_c: draftRow.price_c,
      price_naver: draftRow.price_naver,
      price_coupang: draftRow.price_coupang,
      price_gmarket: draftRow.price_gmarket,
      price_ssg: draftRow.price_ssg,
    };

    const { error } = await supabase
      .from('import_pricing_items')
      .insert(payload)
      .select()
      .single();

    if (error) {
      console.error('Save failed:', error);
      alert(`저장 실패: ${error.message}`);
      return;
    }

    await fetchItems();
    setDraftRow(null);
    setDraftErrors(new Set());
  }, [draftRow, fetchItems]);

  useEffect(() => {
    if (!draftRow) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleDraftCancel();
      } else if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleDraftSave();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [draftRow, handleDraftCancel, handleDraftSave]);

  const enterDeleteMode = () => {
    setDeleteMode(true);
    setSelectedIds(new Set());
  };

  const exitDeleteMode = () => {
    setDeleteMode(false);
    setSelectedIds(new Set());
    setShowConfirmDialog(false);
  };

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === items.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(items.map(it => it.id)));
    }
  };

  const openConfirm = () => {
    if (selectedIds.size === 0) return;
    setShowConfirmDialog(true);
  };

  const confirmDelete = async () => {
    if (selectedIds.size === 0) return;
    setIsDeleting(true);
    const ids = Array.from(selectedIds);
    const { error } = await supabase
      .from('import_pricing_items')
      .delete()
      .in('id', ids);
    setIsDeleting(false);
    if (error) {
      console.error('Delete failed:', error);
      alert(`삭제 실패: ${error.message}`);
      return;
    }
    await fetchItems();
    exitDeleteMode();
  };

  return (
    <div style={{
      padding: 24,
      fontFamily: "'Pretendard', -apple-system, BlinkMacSystemFont, sans-serif",
      color: '#171719',
      background: '#F7F7F8',
      minHeight: '100vh',
      boxSizing: 'border-box',
    }}>
      <style>{`.content { width: 100% !important; }`}</style>

      {/* 헤더 */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 20,
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#171719' }}>
            수입제품 금액 책정
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'rgba(55,56,60,0.61)' }}>
            수입 제품의 도매가 및 채널별 판매가를 책정합니다
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {deleteMode ? (
            <>
              <span style={{
                fontSize: 12, fontWeight: 600, color: '#A32D2D',
                background: '#FCEBEB', borderRadius: 6, padding: '4px 10px',
              }}>삭제 모드</span>
              <span style={{ fontSize: 13, color: 'rgba(55,56,60,0.61)' }}>
                선택 {selectedIds.size}개
              </span>
              <PrimaryButton
                onClick={openConfirm}
                style={{ background: '#A32D2D' }}
              >
                선택 {selectedIds.size}개 삭제
              </PrimaryButton>
              <SecondaryButton onClick={exitDeleteMode}>취소</SecondaryButton>
            </>
          ) : (
            <>
              <SecondaryButton onClick={() => setShowImportModal(true)}>가져오기</SecondaryButton>
              <SecondaryButton onClick={handleAddRow}>행 추가</SecondaryButton>
              <SecondaryButton>템플릿</SecondaryButton>
              <SecondaryButton onClick={enterDeleteMode}>삭제</SecondaryButton>
              <PrimaryButton onClick={() => setIsModalOpen(true)}>설정</PrimaryButton>
            </>
          )}
        </div>
      </div>

      {/* 로딩 / 에러 / 테이블 */}
      {loadState === 'loading' && <LoadingView />}
      {loadState === 'error'   && <ErrorView message={errorMsg} />}
      {loadState === 'ready'   && rates && (
        rows.length === 0 && !draftRow ? (
          <EmptyState />
        ) : (
          <PricingTable
            rows={rows}
            rates={rates}
            visibleCols={resolvedCols}
            draftRow={draftRow}
            draftErrors={draftErrors}
            onDraftChange={handleDraftChange}
            onDraftSave={handleDraftSave}
            onDraftCancel={handleDraftCancel}
            deleteMode={deleteMode}
            selectedIds={selectedIds}
            onToggleSelect={toggleSelect}
            onToggleSelectAll={toggleSelectAll}
          />
        )
      )}

      <ColumnSettingsModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        config={config}
        onApply={next => save(next)}
        onReset={reset}
      />

      <ImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImported={fetchItems}
        existingGenProductIds={existingGenProductIds}
      />

      <DeleteConfirmDialog
        isOpen={showConfirmDialog}
        count={selectedIds.size}
        onConfirm={confirmDelete}
        onCancel={() => setShowConfirmDialog(false)}
      />
    </div>
  );
}

// ============================================================
// 헬퍼 컴포넌트
// ============================================================

interface ButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  style?: CSSProperties;
}

function PrimaryButton({ children, onClick, style }: ButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: '#185FA5',
        color: '#ffffff',
        border: 'none',
        borderRadius: 6,
        padding: '8px 16px',
        fontSize: 13,
        fontWeight: 500,
        fontFamily: 'inherit',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      {children}
    </button>
  );
}

function SecondaryButton({ children, onClick, style }: ButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: '#ffffff',
        color: '#37383C',
        border: '1px solid #E1E2E4',
        borderRadius: 6,
        padding: '8px 16px',
        fontSize: 13,
        fontWeight: 500,
        fontFamily: 'inherit',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      {children}
    </button>
  );
}

function EmptyState() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '80px 24px',
      background: '#ffffff',
      border: '1px solid #E1E2E4',
      borderRadius: 12,
      gap: 12,
    }}>
      <Package size={40} color="rgba(55,56,60,0.28)" />
      <p style={{ margin: 0, fontSize: 14, color: 'rgba(55,56,60,0.61)', fontWeight: 500 }}>
        책정된 제품이 없습니다
      </p>
      <p style={{ margin: 0, fontSize: 13, color: 'rgba(55,56,60,0.28)' }}>
        가져오기 또는 행 추가로 제품을 등록하세요
      </p>
    </div>
  );
}

function LoadingView() {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '80px 24px',
      background: '#ffffff',
      border: '1px solid #E1E2E4',
      borderRadius: 12,
    }}>
      <p style={{ margin: 0, fontSize: 14, color: 'rgba(55,56,60,0.61)' }}>
        데이터 불러오는 중...
      </p>
    </div>
  );
}

function ErrorView({ message }: { message: string }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '80px 24px',
      background: '#ffffff',
      border: '1px solid #E1E2E4',
      borderRadius: 12,
      gap: 12,
    }}>
      <p style={{ margin: 0, fontSize: 14, color: '#C83B38', fontWeight: 500 }}>
        {message}
      </p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        style={{
          background: '#ffffff',
          color: '#37383C',
          border: '1px solid #E1E2E4',
          borderRadius: 6,
          padding: '8px 16px',
          fontSize: 13,
          fontWeight: 500,
          fontFamily: "'Pretendard', -apple-system, sans-serif",
          cursor: 'pointer',
        }}
      >
        다시 시도
      </button>
    </div>
  );
}
