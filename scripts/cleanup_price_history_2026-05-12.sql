-- ==========================================================
-- price_history 1회성 cleanup
-- ==========================================================
-- 작업 일자: 2026-05-12
-- 사유:      2026-05-11 02~04시 폭증 사건 정리
--            (3시간 동안 9,973건 폭증, 99.5%가 code:"단종" 오염 데이터)
--            원인: importExcel 컬럼 폴백 버그 + recalcAll 내 _oldPrices 해시 충돌
--            조치: app.js 작업 1·2에서 폴백 제거 + 단종 필터 추가 완료
-- 영향 범위: mw_price_history 1.5일치 가격 변경 로그 손실
--            (mw_products / mw_price_collect / mw_clients 등 다른 키는 영향 없음)
-- 실행 방법: Supabase MCP 또는 Supabase 대시보드 SQL Editor에서 직접 실행
--            (Claude Code에서 자동 실행 금지)
-- ==========================================================

UPDATE app_data
SET value = '[]'::jsonb,
    updated_at = NOW()
WHERE key = 'mw_price_history';
