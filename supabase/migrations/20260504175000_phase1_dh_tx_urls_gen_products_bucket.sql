-- ============================================================
-- Phase 1: dh_transactions URL 컬럼 추가 + gen-products Storage 버킷 생성
-- ============================================================

-- 1. dh_transactions 컬럼 추가 (PDF/Excel URL 저장)
ALTER TABLE public.dh_transactions
  ADD COLUMN IF NOT EXISTS pdf_url text,
  ADD COLUMN IF NOT EXISTS excel_url text;

COMMENT ON COLUMN public.dh_transactions.pdf_url IS '거래명세서/발주서 PDF Storage URL';
COMMENT ON COLUMN public.dh_transactions.excel_url IS '거래명세서/발주서 Excel Storage URL';

-- 2. gen-products Storage 버킷 생성 (public, 이미지 업로드용)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'gen-products',
  'gen-products',
  true,
  10485760,  -- 10MB 제한
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- 3. gen-products 버킷 RLS 정책
-- 3-1. 모두 SELECT 가능 (public 읽기)
DROP POLICY IF EXISTS "gen-products: public read" ON storage.objects;
CREATE POLICY "gen-products: public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'gen-products');

-- 3-2. 인증된 사용자만 INSERT 가능
DROP POLICY IF EXISTS "gen-products: auth insert" ON storage.objects;
CREATE POLICY "gen-products: auth insert"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'gen-products' AND auth.role() = 'authenticated');

-- 3-3. 인증된 사용자만 UPDATE 가능
DROP POLICY IF EXISTS "gen-products: auth update" ON storage.objects;
CREATE POLICY "gen-products: auth update"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'gen-products' AND auth.role() = 'authenticated');

-- 3-4. 인증된 사용자만 DELETE 가능
DROP POLICY IF EXISTS "gen-products: auth delete" ON storage.objects;
CREATE POLICY "gen-products: auth delete"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'gen-products' AND auth.role() = 'authenticated');
