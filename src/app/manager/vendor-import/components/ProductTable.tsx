'use client';

import type { GenProduct } from '../lib/types';
import { fmt } from '../lib/storage';
import { colors, fonts, spacing, ui } from '../lib/design-tokens';

interface ProductTableProps {
  products: GenProduct[];
  onAddToCart?: (p: GenProduct) => void;
  isClientSelected: boolean;  // 거래처 선택 여부 (🛒 활성/비활성)
}

export default function ProductTable({ products, onAddToCart, isClientSelected }: ProductTableProps) {
  // 빈 상태
  if (products.length === 0) {
    return (
      <div
        style={{
          padding: spacing.s6,
          textAlign: 'center',
          color: colors.textHint,
          fontSize: fonts.body.size,
        }}
      >
        조건에 맞는 제품이 없습니다
      </div>
    );
  }

  const handleCartClick = (p: GenProduct) => {
    if (!isClientSelected) {
      alert('거래처를 먼저 선택하세요.');
      return;
    }
    if (onAddToCart) {
      onAddToCart(p);
    } else {
      alert('Phase 5-f에서 구현됩니다.');
    }
  };

  // tier price 표시 (qty/price 2줄)
  const renderTierCell = (qty: number | null | undefined, price: number | null | undefined) => {
    const qtyStr = qty && qty > 0 ? `${qty.toLocaleString()}개` : '-';
    const priceStr = fmt(price);
    if (qtyStr === '-' && priceStr === '-') return <span style={{ color: colors.textHint }}>-</span>;
    return (
      <div style={{ lineHeight: 1.3 }}>
        <div style={{ fontSize: '10px', color: colors.textHint }}>{qtyStr}</div>
        <div style={{ fontSize: '12px', color: colors.text, fontWeight: 500 }}>{priceStr}</div>
      </div>
    );
  };

  return (
    <div
      style={{
        flex: 1,
        overflow: 'auto',
        backgroundColor: colors.bg,
      }}
    >
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: fonts.tableCell.size,
          fontFamily: fonts.family,
        }}
      >
        <thead>
          <tr>
            {[
              { label: '코드', width: '90px', align: 'center' },
              { label: '관리코드', width: '120px', align: 'center' },
              { label: '품명', width: 'auto', align: 'left' },
              { label: '규격', width: '180px', align: 'left' },
              { label: '원가', width: '90px', align: 'right' },
              { label: 'IN', width: '100px', align: 'center' },
              { label: 'OUT', width: '100px', align: 'center' },
              { label: '파레트', width: '100px', align: 'center' },
              { label: '🛒', width: '50px', align: 'center' },
            ].map((col, i) => (
              <th
                key={i}
                style={{
                  height: ui.tableHeaderHeight,
                  padding: `${spacing.s2} ${spacing.s3}`,
                  textAlign: col.align as 'left' | 'right' | 'center',
                  fontWeight: fonts.tableHeader.weight,
                  fontSize: fonts.tableHeader.size,
                  color: colors.textSecondary,
                  backgroundColor: colors.bgTertiary,
                  borderBottom: `1px solid ${colors.border}`,
                  position: 'sticky',
                  top: 0,
                  zIndex: 10,
                  width: col.width,
                  whiteSpace: 'nowrap',
                }}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {products.map((p, idx) => {
            const isEven = idx % 2 === 1;  // 0-indexed, 1번째 행이 짝수처럼 zebra
            return (
              <tr
                key={p.code || idx}
                style={{
                  backgroundColor: isEven ? colors.tableZebra : colors.bg,
                  transition: 'background-color 0.1s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = colors.bgSecondary;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = isEven ? colors.tableZebra : colors.bg;
                }}
              >
                <td style={cellStyle('center')}>{p.code || '-'}</td>
                <td style={cellStyle('center', { fontFamily: fonts.mono })}>{p.manageCode || '-'}</td>
                <td style={cellStyle('left', { fontWeight: 500 })}>{p.model || '-'}</td>
                <td style={cellStyle('left', { color: colors.textSecondary, fontSize: fonts.bodySm.size })}>
                  {p.description || '-'}
                </td>
                <td style={cellStyle('right', { color: colors.success, fontWeight: 500 })}>
                  {fmt(p.cost)}
                </td>
                <td style={cellStyle('center')}>{renderTierCell(p.inQty, p.inPrice)}</td>
                <td style={cellStyle('center')}>{renderTierCell(p.outQty, p.outPrice)}</td>
                <td style={cellStyle('center')}>{renderTierCell(p.palletQty, p.palletPrice)}</td>
                <td style={cellStyle('center', { padding: 0 })}>
                  <button
                    type="button"
                    onClick={() => handleCartClick(p)}
                    disabled={!isClientSelected}
                    style={{
                      width: '32px',
                      height: '28px',
                      backgroundColor: isClientSelected ? colors.primary : colors.bgTertiary,
                      color: isClientSelected ? '#fff' : colors.textHint,
                      border: 'none',
                      borderRadius: '4px',
                      fontSize: '14px',
                      cursor: isClientSelected ? 'pointer' : 'not-allowed',
                      fontFamily: fonts.family,
                    }}
                  >
                    🛒
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// 셀 스타일 헬퍼
function cellStyle(
  align: 'left' | 'right' | 'center',
  extra: React.CSSProperties = {}
): React.CSSProperties {
  return {
    height: ui.tableHeaderHeight,
    padding: `${spacing.s2} ${spacing.s3}`,
    textAlign: align,
    color: colors.text,
    fontSize: fonts.tableCell.size,
    borderBottom: `1px solid ${colors.borderRow}`,
    ...extra,
  };
}
