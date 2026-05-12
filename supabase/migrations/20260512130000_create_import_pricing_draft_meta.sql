-- 메타 테이블: 책정안 표지 정보 (1 row per draft_no)
-- 품목 행은 import_pricing_drafts 에 별도 저장 (1:N)
-- 신규 책정안 생성 시 메타 1줄 INSERT, 품목은 사용자가 채울 때까지 0줄 OK
CREATE TABLE IF NOT EXISTS public.import_pricing_draft_meta (
  draft_no    TEXT PRIMARY KEY,
  draft_name  TEXT,
  tab_type    TEXT NOT NULL CHECK (tab_type IN ('pricing','promotion')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by  TEXT
);

-- 탭별 필터 조회용 인덱스
CREATE INDEX IF NOT EXISTS idx_ipdm_tab ON public.import_pricing_draft_meta (tab_type);

-- updated_at 자동 갱신 트리거 (set_updated_at 함수는 DB에 사전 등록됨)
DROP TRIGGER IF EXISTS trg_ipdm_updated_at ON public.import_pricing_draft_meta;
CREATE TRIGGER trg_ipdm_updated_at
  BEFORE UPDATE ON public.import_pricing_draft_meta
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS: 사이트 전체 공유 데이터라 read/write 모두 anon 허용 (import_pricing_drafts와 동일 정책)
ALTER TABLE public.import_pricing_draft_meta ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ipdm_read" ON public.import_pricing_draft_meta;
CREATE POLICY "ipdm_read" ON public.import_pricing_draft_meta
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "ipdm_write" ON public.import_pricing_draft_meta;
CREATE POLICY "ipdm_write" ON public.import_pricing_draft_meta
  FOR ALL USING (true) WITH CHECK (true);

-- 컬럼 설명
COMMENT ON TABLE  public.import_pricing_draft_meta            IS '제품금액 책정/제품 프로모션 책정 메뉴 — 책정안 메타 정보 (품목 행은 import_pricing_drafts 에 분리)';
COMMENT ON COLUMN public.import_pricing_draft_meta.draft_no   IS '책정안 번호 PR-YYYY-NNN (PK)';
COMMENT ON COLUMN public.import_pricing_draft_meta.draft_name IS '사용자 지정 이름 (예: 11월 수입분)';
COMMENT ON COLUMN public.import_pricing_draft_meta.tab_type   IS 'pricing=제품금액 책정 탭, promotion=제품 프로모션 책정 탭';
COMMENT ON COLUMN public.import_pricing_draft_meta.created_by IS '생성자 사용자명 (admin/hwon/jyoung 등)';
