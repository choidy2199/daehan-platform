'use client';

import type { CSSProperties } from 'react';
import { WholesaleCell, ChannelCell } from './PriceCell';
import { detectCategory, type ChannelFeeRates } from '../lib/feeCalc';
import type { ColumnDef } from '../lib/columnConfig';
import type { DraftRow } from '../page';

export interface PricingRow {
  id: number;
  genProductId: number | null;
  imgUrl?: string | null;
  code: string;
  manageCode: string;
  category: string;
  model: string;
  spec: string;
  stock: number;
  cost: number;
  priceA: number;
  priceB: number;
  priceC: number;
  priceNaver: number;
  priceCoupang: number;
  priceGmarket: number;
  priceSsg: number;
  inQty: number;
  outQty: number;
  pallet: number;
  overrideCategory?: 'powertool' | 'handtool' | null;
}

export interface PricingTableProps {
  rows: PricingRow[];
  rates: ChannelFeeRates | null;
  visibleCols: ColumnDef[];
  draftRow?: DraftRow | null;
  draftErrors?: Set<string>;
  onDraftChange?: (field: keyof DraftRow, value: any) => void;
  onDraftSave?: () => void;
  onDraftCancel?: () => void;
}

// sticky 컬럼 left 오프셋 (photo→code→manageCode 순 고정값)
const STICKY_LEFT: Record<string, number> = { photo: 0, code: 44, manageCode: 104 };

export function PricingTable({
  rows, rates, visibleCols,
  draftRow, draftErrors, onDraftChange, onDraftSave, onDraftCancel,
}: PricingTableProps) {
  const lastStickyId = [...visibleCols].reverse().find(c => c.sticky)?.id;

  return (
    <div style={{
      overflowX: 'auto',
      border: '1px solid #E1E2E4',
      borderRadius: 12,
      background: '#ffffff',
    }}>
      <table style={{
        borderCollapse: 'separate',
        borderSpacing: 0,
        fontSize: 14,
        fontFamily: "'Pretendard', -apple-system, sans-serif",
        width: '100%',
      }}>
        <thead>
          <tr>
            {visibleCols.map(col => (
              <Th
                key={col.id}
                width={col.width}
                sep={col.sep}
                sticky={!!col.sticky}
                left={col.sticky ? STICKY_LEFT[col.sticky] : undefined}
                lastSticky={col.id === lastStickyId}
              >
                {col.header}
              </Th>
            ))}
          </tr>
        </thead>
        <tbody>
          {draftRow && (
            <DraftRowComponent
              draft={draftRow}
              errors={draftErrors ?? new Set()}
              visibleCols={visibleCols}
              onChange={onDraftChange!}
              onSave={onDraftSave!}
              onCancel={onDraftCancel!}
            />
          )}
          {rows.map(row => {
            const category = detectCategory(row.category, row.overrideCategory);
            const prices = { cost: row.cost, priceA: row.priceA, priceB: row.priceB, priceC: row.priceC };
            return (
              <tr key={row.id}>
                {visibleCols.map(col =>
                  renderCell(col, row, category, prices, rates, col.id === lastStickyId)
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function renderCell(
  col: ColumnDef,
  row: PricingRow,
  category: 'powertool' | 'handtool',
  prices: { cost: number; priceA: number; priceB: number; priceC: number },
  rates: ChannelFeeRates | null,
  isLastSticky: boolean,
) {
  const stickyLeft = col.sticky ? STICKY_LEFT[col.sticky] : undefined;
  const base = { sep: col.sep, sticky: !!col.sticky, left: stickyLeft, lastSticky: isLastSticky };

  switch (col.id) {
    case 'photo':
      return (
        <Td key={col.id} {...base}>
          <div style={{
            width: 32, height: 32, background: '#EAF2FE', borderRadius: 4,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#0054D1', fontSize: 9.5,
          }}>IMG</div>
        </Td>
      );
    case 'code':
      return (
        <Td key={col.id} {...base}>
          {row.code}
          {row.genProductId === null && (
            <span style={{
              marginLeft: 4, padding: '1px 6px',
              background: '#F1EFE8', color: '#5F5E5A',
              fontSize: 11, borderRadius: 8,
            }}>직접추가</span>
          )}
        </Td>
      );
    case 'manageCode':
      return <Td key={col.id} {...base}>{row.manageCode}</Td>;
    case 'category':
      return (
        <Td key={col.id} {...base}>
          <CategoryBadge category={category} text={row.category} />
        </Td>
      );
    case 'name':
      return <Td key={col.id} {...base}>{row.model}</Td>;
    case 'spec':
      return <Td key={col.id} {...base} style={{ color: 'rgba(55, 56, 60, 0.61)' }}>{row.spec}</Td>;
    case 'stock':
      return <Td key={col.id} {...base} center>{row.stock}</Td>;
    case 'cost':
      return (
        <Td key={col.id} {...base} style={{ textAlign: 'center', background: 'rgba(112, 115, 124, 0.05)' }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>{row.cost.toLocaleString()}</div>
          <div style={{ fontSize: 11, color: 'rgba(55, 56, 60, 0.28)', marginTop: 3 }}>기준</div>
        </Td>
      );
    case 'priceA':
      return <Td key={col.id} {...base}><WholesaleCell price={row.priceA} cost={row.cost} /></Td>;
    case 'priceB':
      return <Td key={col.id} {...base}><WholesaleCell price={row.priceB} cost={row.cost} /></Td>;
    case 'priceC':
      return <Td key={col.id} {...base}><WholesaleCell price={row.priceC} cost={row.cost} /></Td>;
    case 'storefarm':
      return (
        <Td key={col.id} {...base} noPadding>
          {rates && <ChannelCell price={row.priceNaver} channel="naver" category={category} rates={rates} prices={prices} />}
        </Td>
      );
    case 'coupang':
      return (
        <Td key={col.id} {...base} noPadding>
          {rates && <ChannelCell price={row.priceCoupang} channel="coupang_mp" category={category} rates={rates} prices={prices} />}
        </Td>
      );
    case 'openmarket':
      return (
        <Td key={col.id} {...base} noPadding>
          {rates && <ChannelCell price={row.priceGmarket} channel="gmarket" category={category} rates={rates} prices={prices} />}
        </Td>
      );
    case 'ssg':
      return (
        <Td key={col.id} {...base} noPadding>
          {rates && <ChannelCell price={row.priceSsg} channel="ssg" category={category} rates={rates} prices={prices} />}
        </Td>
      );
    case 'inStock':
      return <Td key={col.id} {...base} center>{row.inQty}</Td>;
    case 'outStock':
      return <Td key={col.id} {...base} center>{row.outQty}</Td>;
    case 'pallet':
      return <Td key={col.id} {...base} center>{row.pallet}</Td>;
    default:
      return null;
  }
}

// ============================================================
// 헬퍼 컴포넌트
// ============================================================
interface ThProps {
  children: React.ReactNode;
  width?: number;
  sticky?: boolean;
  left?: number;
  sep?: boolean;
  lastSticky?: boolean;
}

function Th({ children, width, sticky, left, sep, lastSticky }: ThProps) {
  return (
    <th style={{
      fontWeight: 600,
      fontSize: 12,
      color: 'rgba(55, 56, 60, 0.95)',
      background: '#DEE1E4',
      padding: '8px 6px',
      textAlign: 'center',
      borderBottom: '1px solid #EAEBEC',
      whiteSpace: 'nowrap',
      width: width ?? undefined,
      minWidth: width ?? undefined,
      position: sticky ? 'sticky' : undefined,
      left: sticky ? left : undefined,
      zIndex: sticky ? 11 : undefined,
      borderLeft: sep ? '1px solid #EAEBEC' : undefined,
      boxShadow: lastSticky ? '2px 0 4px -1px rgba(23, 23, 23, 0.06)' : undefined,
    }}>{children}</th>
  );
}

interface TdProps {
  children?: React.ReactNode;
  sticky?: boolean;
  left?: number;
  sep?: boolean;
  center?: boolean;
  noPadding?: boolean;
  lastSticky?: boolean;
  style?: CSSProperties;
}

function Td({ children, sticky, left, sep, center, noPadding, lastSticky, style }: TdProps) {
  return (
    <td style={{
      padding: noPadding ? 0 : '8px 6px',
      verticalAlign: 'middle',
      borderBottom: '1px solid #EAEBEC',
      fontSize: 14,
      color: '#171719',
      background: sticky ? '#ffffff' : undefined,
      position: sticky ? 'sticky' : undefined,
      left: sticky ? left : undefined,
      zIndex: sticky ? 10 : undefined,
      borderLeft: sep ? '1px solid #EAEBEC' : undefined,
      textAlign: center ? 'center' : undefined,
      boxShadow: lastSticky ? '2px 0 4px -1px rgba(23, 23, 23, 0.06)' : undefined,
      ...style,
    }}>{children}</td>
  );
}

// ============================================================
// DraftRowComponent — 행 추가 인라인 편집
// ============================================================
interface DraftRowComponentProps {
  draft: DraftRow;
  errors: Set<string>;
  visibleCols: ColumnDef[];
  onChange: (field: keyof DraftRow, value: any) => void;
  onSave: () => void;
  onCancel: () => void;
}

const DRAFT_INPUT_BASE: CSSProperties = {
  height: 30,
  fontSize: 12,
  padding: '0 6px',
  borderRadius: 4,
  width: '100%',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
  outline: 'none',
};

function draftInputStyle(hasError: boolean): CSSProperties {
  return {
    ...DRAFT_INPUT_BASE,
    border: hasError ? '1px solid #DC2626' : '0.5px solid var(--color-border-secondary)',
  };
}

function DraftRowComponent({ draft, errors, visibleCols, onChange, onSave, onCancel }: DraftRowComponentProps) {
  const numProps = (field: keyof DraftRow, value: number | null) => ({
    type: 'number',
    value: value ?? '',
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      onChange(field, e.target.value === '' ? null : Number(e.target.value)),
  });

  const renderDraftCell = (col: ColumnDef) => {
    switch (col.id) {
      case 'photo':
        return (
          <td key={col.id} style={draftTdStyle}>
            <div style={{
              width: 32, height: 32, background: '#F4F5F6', borderRadius: 4,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'rgba(55,56,60,0.4)', fontSize: 16,
            }}>+</div>
          </td>
        );
      case 'code':
        return (
          <td key={col.id} style={draftTdStyle}>
            <input
              className="ip-draft-input" type="text" placeholder="자동"
              value={draft.custom_code}
              onChange={e => onChange('custom_code', e.target.value)}
              style={draftInputStyle(false)}
            />
          </td>
        );
      case 'manageCode':
        return (
          <td key={col.id} style={draftTdStyle}>
            <input
              className="ip-draft-input" type="text" placeholder="관리코드"
              value={draft.custom_manage_code}
              onChange={e => onChange('custom_manage_code', e.target.value)}
              style={draftInputStyle(false)}
            />
          </td>
        );
      case 'category':
        return (
          <td key={col.id} style={draftTdStyle}>
            <select
              className="ip-draft-input"
              value={draft.override_category ?? ''}
              onChange={e => onChange('override_category', e.target.value === '' ? null : e.target.value)}
              style={draftInputStyle(errors.has('override_category'))}
            >
              <option value="">선택</option>
              <option value="powertool">전동공구</option>
              <option value="handtool">수공구</option>
            </select>
          </td>
        );
      case 'name':
        return (
          <td key={col.id} style={draftTdStyle}>
            <input
              className="ip-draft-input" type="text" placeholder="품명"
              value={draft.custom_model}
              onChange={e => onChange('custom_model', e.target.value)}
              style={draftInputStyle(errors.has('custom_model'))}
            />
          </td>
        );
      case 'spec':
        return (
          <td key={col.id} style={draftTdStyle}>
            <input
              className="ip-draft-input" type="text" placeholder="규격"
              value={draft.custom_spec}
              onChange={e => onChange('custom_spec', e.target.value)}
              style={draftInputStyle(errors.has('custom_spec'))}
            />
          </td>
        );
      case 'cost':
        return (
          <td key={col.id} style={draftTdStyle}>
            <input
              className="ip-draft-input" placeholder="0"
              {...numProps('cost', draft.cost)}
              style={draftInputStyle(errors.has('cost'))}
            />
          </td>
        );
      case 'priceA':
        return <td key={col.id} style={draftTdStyle}><input className="ip-draft-input" placeholder="—" {...numProps('price_a', draft.price_a)} style={draftInputStyle(false)} /></td>;
      case 'priceB':
        return <td key={col.id} style={draftTdStyle}><input className="ip-draft-input" placeholder="—" {...numProps('price_b', draft.price_b)} style={draftInputStyle(false)} /></td>;
      case 'priceC':
        return <td key={col.id} style={draftTdStyle}><input className="ip-draft-input" placeholder="—" {...numProps('price_c', draft.price_c)} style={draftInputStyle(false)} /></td>;
      case 'storefarm':
        return <td key={col.id} style={draftTdStyle}><input className="ip-draft-input" placeholder="—" {...numProps('price_naver', draft.price_naver)} style={draftInputStyle(false)} /></td>;
      case 'coupang':
        return <td key={col.id} style={draftTdStyle}><input className="ip-draft-input" placeholder="—" {...numProps('price_coupang', draft.price_coupang)} style={draftInputStyle(false)} /></td>;
      case 'openmarket':
        return <td key={col.id} style={draftTdStyle}><input className="ip-draft-input" placeholder="—" {...numProps('price_gmarket', draft.price_gmarket)} style={draftInputStyle(false)} /></td>;
      case 'ssg':
        return <td key={col.id} style={draftTdStyle}><input className="ip-draft-input" placeholder="—" {...numProps('price_ssg', draft.price_ssg)} style={draftInputStyle(false)} /></td>;
      case 'stock':
      case 'inStock':
      case 'outStock':
      case 'pallet':
        return <td key={col.id} style={{ ...draftTdStyle, textAlign: 'center', color: 'rgba(55,56,60,0.28)' }}>—</td>;
      default:
        return <td key={col.id} style={draftTdStyle} />;
    }
  };

  return (
    <tr style={{ background: '#FFFBEB' }}>
      <style>{`.ip-draft-input:focus { outline: 2px solid #185FA5; }`}</style>
      {visibleCols.map(renderDraftCell)}
      <td style={{ position: 'sticky', right: 0, background: '#FFFBEB', padding: '4px' }}>
        <button onClick={onSave} title="저장 (Enter)" style={{
          width: 24, height: 24, marginRight: 4,
          background: '#185FA5', color: 'white', border: 'none',
          borderRadius: 4, cursor: 'pointer', fontSize: 14,
        }}>✓</button>
        <button onClick={onCancel} title="취소 (ESC)" style={{
          width: 24, height: 24,
          background: 'white', border: '0.5px solid #E1E2E4',
          borderRadius: 4, cursor: 'pointer', fontSize: 14,
        }}>✕</button>
      </td>
    </tr>
  );
}

const draftTdStyle: CSSProperties = {
  padding: '4px 6px',
  borderBottom: '1px solid #EAEBEC',
  verticalAlign: 'middle',
};

function CategoryBadge({ category, text }: { category: 'powertool' | 'handtool'; text: string }) {
  const styles = category === 'powertool'
    ? { background: '#C1D9FC', color: '#0054D1' }
    : { background: 'rgba(0, 191, 64, 0.25)', color: '#009632' };

  return (
    <span style={{
      display: 'inline-block',
      fontSize: 12,
      fontWeight: 500,
      padding: '2px 6px',
      borderRadius: 8,
      whiteSpace: 'nowrap' as const,
      ...styles,
    }}>{text || (category === 'powertool' ? '전동공구' : '수공구')}</span>
  );
}
