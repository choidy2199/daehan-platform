-- 2026-05-13: import-pricing 메뉴 신규
-- 책정 데이터 + 브랜드 템플릿
-- RLS: 미적용 (기존 패턴 따름)

-- =====================================================
-- Table 1: import_pricing_items
-- 책정 데이터 (등록/미등록 통합)
--
-- 등록 제품: gen_product_id NOT NULL, custom_* NULL
-- 미등록 제품: gen_product_id NULL, custom_* 자유 입력
--
-- cost 동작:
--   NULL이면 mw_gen_products.cost 참조 (등록 제품만)
--   값 있으면 오버라이드 (일반단가표 안 건드림)
--
-- NULL 가격: 클라이언트에서 0원으로 저장, "미책정" 뱃지 표시
-- =====================================================

CREATE TABLE IF NOT EXISTS import_pricing_items (
  id BIGSERIAL PRIMARY KEY,

  -- 등록/미등록 분기
  gen_product_id BIGINT,

  -- 미등록 제품용 자유 입력 (gen_product_id NULL일 때 사용)
  custom_code TEXT,
  custom_manage_code TEXT,
  custom_category TEXT,
  custom_model TEXT,        -- 품명 = 브랜드
  custom_spec TEXT,         -- 규격 = 모델명

  -- 가격
  cost INT,
  price_a INT,
  price_b INT,
  price_c INT,
  price_naver INT,
  price_coupang INT,
  price_gmarket INT,
  price_ssg INT,

  -- 카테고리 자동분기 오버라이드 (등록 제품용)
  override_category TEXT,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 등록 제품은 gen_product_id 1:1 (UNIQUE)
-- 미등록 제품(NULL)은 여러 행 허용
CREATE UNIQUE INDEX IF NOT EXISTS idx_import_pricing_items_gen_product_id
  ON import_pricing_items(gen_product_id)
  WHERE gen_product_id IS NOT NULL;

-- updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION update_import_pricing_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_import_pricing_items_updated_at ON import_pricing_items;
CREATE TRIGGER trg_import_pricing_items_updated_at
  BEFORE UPDATE ON import_pricing_items
  FOR EACH ROW
  EXECUTE FUNCTION update_import_pricing_items_updated_at();

-- =====================================================
-- Table 2: import_pricing_templates
-- 브랜드 템플릿 (등록/미등록 통합 묶음)
--
-- item_ids = import_pricing_items.id 배열
-- 가격 포함 복원 (템플릿 적용 시 이전 책정 가격까지 함께)
-- =====================================================

CREATE TABLE IF NOT EXISTS import_pricing_templates (
  id BIGSERIAL PRIMARY KEY,
  brand TEXT NOT NULL,       -- 품명 = 브랜드명
  memo TEXT,                  -- 저장 시 메모 (저장 팝업에서 입력, 모달에서 인라인 수정)
  item_ids BIGINT[] NOT NULL, -- import_pricing_items.id 배열
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_import_pricing_templates_brand
  ON import_pricing_templates(brand);

CREATE INDEX IF NOT EXISTS idx_import_pricing_templates_created_at
  ON import_pricing_templates(created_at DESC);
