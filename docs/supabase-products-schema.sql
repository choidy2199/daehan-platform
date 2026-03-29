-- Supabase products 테이블 생성 SQL
-- Supabase Dashboard → SQL Editor에서 실행

CREATE TABLE IF NOT EXISTS products (
  id BIGSERIAL PRIMARY KEY,
  code TEXT NOT NULL DEFAULT '',
  manage_code TEXT DEFAULT '',
  category TEXT DEFAULT '',
  subcategory TEXT DEFAULT '',
  detail TEXT DEFAULT '',
  order_num TEXT DEFAULT '',
  tti_num TEXT DEFAULT '',
  model TEXT DEFAULT '',
  description TEXT DEFAULT '',
  supply_price INTEGER DEFAULT 0,
  product_dc NUMERIC DEFAULT 0,
  cost INTEGER DEFAULT 0,
  price_a INTEGER DEFAULT 0,
  price_retail INTEGER DEFAULT 0,
  price_naver INTEGER DEFAULT 0,
  price_open INTEGER DEFAULT 0,
  raised_price INTEGER DEFAULT 0,
  raise_rate NUMERIC DEFAULT 0,
  discontinued TEXT DEFAULT '',
  tti_stock TEXT DEFAULT '',
  in_date TEXT DEFAULT '',
  product_type TEXT NOT NULL DEFAULT 'milwaukee',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- upsert용 유니크 인덱스 (code + product_type)
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_code_type
  ON products (code, product_type);

-- product_type 필터용 인덱스
CREATE INDEX IF NOT EXISTS idx_products_type
  ON products (product_type);

-- RLS (Row Level Security) 비활성화 — 서버사이드 API에서만 접근
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- service_role은 모든 접근 허용
CREATE POLICY "Service role full access" ON products
  FOR ALL USING (true) WITH CHECK (true);

-- updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
