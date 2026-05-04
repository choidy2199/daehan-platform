'use client';

import { colors, fonts, spacing, radius, borders, shadows, ui } from './lib/design-tokens';

export default function VendorImportPage() {
  return (
    <div
      style={{
        width: '100%',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: fonts.family,
        backgroundColor: colors.bgSecondary,
        color: colors.text,
        fontSize: fonts.body.size,
        fontWeight: fonts.body.weight,
        overflow: 'hidden',
      }}
    >
      {/* 페이지 헤더 (다크) */}
      <div
        style={{
          height: ui.sectionHeaderHeight,
          backgroundColor: colors.sectionHeaderBg,
          color: colors.sectionHeaderText,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: `0 ${spacing.s4}`,
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontSize: fonts.panelHeader.size,
            fontWeight: fonts.panelHeader.weight,
          }}
        >
          📦 업체수입제품
        </span>
        <button
          type="button"
          style={{
            height: ui.buttonHeight.sm,
            padding: `0 ${spacing.s3}`,
            backgroundColor: 'transparent',
            color: colors.sectionHeaderText,
            border: `1px solid ${colors.sectionHeaderText}`,
            borderRadius: radius.base,
            fontSize: fonts.bodySm.size,
            cursor: 'pointer',
          }}
        >
          📋 발주서 리스트
        </button>
      </div>

      {/* 본체: 좌 70% / 우 30% */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          minHeight: 0,
          overflow: 'hidden',
        }}
      >
        {/* 좌측 70% — 거래처 + 브랜드 sub-tab + 제품 테이블 */}
        <div
          style={{
            flex: '0 0 70%',
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
            borderRight: borders.base,
            backgroundColor: colors.bg,
          }}
        >
          {/* 거래처 선택 (Phase 5-b에서 구현) */}
          <div
            style={{
              padding: spacing.s3,
              borderBottom: borders.base,
              flexShrink: 0,
            }}
          >
            <div
              style={{
                padding: spacing.s3,
                border: `2px dashed ${colors.danger}`,
                borderRadius: radius.base,
                backgroundColor: colors.dangerBg,
                color: colors.danger,
                fontSize: fonts.bodySm.size,
                textAlign: 'center',
              }}
            >
              ⚠️ 거래처 선택 (필수) — Phase 5-b에서 구현
            </div>
          </div>

          {/* 브랜드 sub-tab + ⚙ 컬럼 설정 (Phase 5-c, 5-e) */}
          <div
            style={{
              padding: `${spacing.s2} ${spacing.s3}`,
              borderBottom: borders.base,
              backgroundColor: colors.bgSecondary,
              color: colors.textSecondary,
              fontSize: fonts.bodySm.size,
              flexShrink: 0,
            }}
          >
            🏷️ 브랜드 sub-tab (Phase 5-c) | ⚙️ 컬럼 설정 (Phase 5-e)
          </div>

          {/* 제품 테이블 (Phase 5-c, 5-d) */}
          <div
            style={{
              flex: 1,
              minHeight: 0,
              overflow: 'auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: colors.textHint,
              fontSize: fonts.bodySm.size,
            }}
          >
            제품 테이블 + 사진 (Phase 5-c, 5-d)
          </div>
        </div>

        {/* 우측 30% — 장바구니 */}
        <div
          style={{
            flex: '0 0 30%',
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
            backgroundColor: colors.bg,
          }}
        >
          {/* 장바구니 헤더 */}
          <div
            style={{
              padding: spacing.s3,
              borderBottom: borders.base,
              fontSize: fonts.panelHeader.size,
              fontWeight: fonts.panelHeader.weight,
              flexShrink: 0,
            }}
          >
            🛒 장바구니
          </div>

          {/* 장바구니 본체 (Phase 5-f) */}
          <div
            style={{
              flex: 1,
              minHeight: 0,
              overflow: 'auto',
              padding: spacing.s3,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: colors.textHint,
              fontSize: fonts.bodySm.size,
            }}
          >
            장바구니 (Phase 5-f)
          </div>
        </div>
      </div>
    </div>
  );
}
