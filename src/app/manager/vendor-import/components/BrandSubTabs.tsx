'use client';

import { useRef, useCallback, useState } from 'react';
import { colors, fonts, spacing, radius, borders } from '../lib/design-tokens';

interface BrandSubTabsProps {
  brands: { name: string; count: number }[];  // 입력 순서 그대로 + 카운트
  activeBrand: string;  // 'ALL' 또는 브랜드명
  totalCount: number;  // 전체 카운트 (ALL용)
  query: string;
  onBrandChange: (brand: string) => void;
  onQueryChange: (q: string) => void;
}

const DEBOUNCE_MS = 150;

export default function BrandSubTabs({
  brands,
  activeBrand,
  totalCount,
  query,
  onBrandChange,
  onQueryChange,
}: BrandSubTabsProps) {
  const [localQuery, setLocalQuery] = useState<string>(query);
  const debounceTimer = useRef<number | null>(null);
  const isComposing = useRef<boolean>(false);

  // 검색 input handler
  const handleInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setLocalQuery(raw);
    if (isComposing.current) return;
    if (debounceTimer.current !== null) {
      window.clearTimeout(debounceTimer.current);
    }
    debounceTimer.current = window.setTimeout(() => {
      onQueryChange(raw);
    }, DEBOUNCE_MS);
  }, [onQueryChange]);

  const handleCompositionStart = useCallback(() => {
    isComposing.current = true;
  }, []);

  const handleCompositionEnd = useCallback((e: React.CompositionEvent<HTMLInputElement>) => {
    isComposing.current = false;
    const raw = (e.target as HTMLInputElement).value;
    setLocalQuery(raw);
    if (debounceTimer.current !== null) {
      window.clearTimeout(debounceTimer.current);
    }
    debounceTimer.current = window.setTimeout(() => {
      onQueryChange(raw);
    }, DEBOUNCE_MS);
  }, [onQueryChange]);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: spacing.s2,
        padding: `${spacing.s2} ${spacing.s3}`,
        borderBottom: borders.base,
        backgroundColor: colors.bg,
        flexShrink: 0,
      }}
    >
      {/* 브랜드 탭 (가로 스크롤 가능) */}
      <div
        style={{
          display: 'flex',
          gap: spacing.s1,
          overflow: 'hidden',
          flex: 1,
          minWidth: 0,
        }}
      >
        {/* ALL 탭 (항상 첫번째) */}
        <button
          type="button"
          onClick={() => onBrandChange('ALL')}
          style={{
            flexShrink: 0,
            height: '30px',
            padding: `0 ${spacing.s3}`,
            border: 'none',
            borderRadius: radius.base,
            fontSize: fonts.bodySm.size,
            fontWeight: 500,
            cursor: 'pointer',
            fontFamily: fonts.family,
            backgroundColor: activeBrand === 'ALL' ? colors.primary : colors.bgSecondary,
            color: activeBrand === 'ALL' ? '#fff' : colors.text,
            display: 'flex',
            alignItems: 'center',
            gap: spacing.s1,
          }}
        >
          ALL
          <span
            style={{
              fontSize: '10px',
              opacity: 0.85,
            }}
          >
            {totalCount}
          </span>
        </button>

        {/* 브랜드별 탭 */}
        {brands.map((b) => {
          const isActive = activeBrand === b.name;
          return (
            <button
              key={b.name}
              type="button"
              onClick={() => onBrandChange(b.name)}
              style={{
                flexShrink: 0,
                height: '30px',
                padding: `0 ${spacing.s3}`,
                border: 'none',
                borderRadius: radius.base,
                fontSize: fonts.bodySm.size,
                fontWeight: 500,
                cursor: 'pointer',
                fontFamily: fonts.family,
                backgroundColor: isActive ? colors.primary : colors.bgSecondary,
                color: isActive ? '#fff' : colors.text,
                display: 'flex',
                alignItems: 'center',
                gap: spacing.s1,
              }}
            >
              {b.name}
              <span
                style={{
                  fontSize: '10px',
                  opacity: 0.85,
                }}
              >
                {b.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* 검색 input (우측) */}
      <input
        type="text"
        value={localQuery}
        placeholder="코드 / 품명 / 규격 검색"
        autoComplete="nope"
        spellCheck={false}
        data-form-type="other"
        data-lpignore="true"
        data-1p-ignore="true"
        name="vi_product_search"
        onChange={handleInput}
        onCompositionStart={handleCompositionStart}
        onCompositionEnd={handleCompositionEnd}
        style={{
          flexShrink: 0,
          width: '220px',
          height: '30px',
          padding: `0 ${spacing.s3}`,
          border: borders.base,
          borderRadius: radius.base,
          fontSize: fonts.bodySm.size,
          fontFamily: fonts.family,
          backgroundColor: colors.bg,
          color: colors.text,
          boxSizing: 'border-box',
          outline: 'none',
        }}
      />
    </div>
  );
}
