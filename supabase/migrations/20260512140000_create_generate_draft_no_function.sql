-- DB 함수: 책정안 번호 PR-YYYY-NNN 원자적 생성 + 메타 행 INSERT
-- 동시성: 같은 연도 단위로 advisory lock (트랜잭션 종료 시 자동 해제)
-- 카운터: 탭 종류 무관하게 연도별 통합 (pricing/promotion 합쳐서 NNN 증가)
CREATE OR REPLACE FUNCTION public.generate_draft_no(
  p_tab_type   TEXT,
  p_created_by TEXT,
  p_draft_name TEXT DEFAULT NULL
)
RETURNS public.import_pricing_draft_meta
LANGUAGE plpgsql
AS $$
DECLARE
  v_year     INT  := EXTRACT(YEAR FROM (now() AT TIME ZONE 'Asia/Seoul'))::INT;
  v_prefix   TEXT := 'PR-' || v_year::TEXT || '-';
  v_next_seq INT;
  v_draft_no TEXT;
  v_row      public.import_pricing_draft_meta;
BEGIN
  IF p_tab_type NOT IN ('pricing','promotion') THEN
    RAISE EXCEPTION 'invalid tab_type: %', p_tab_type
      USING ERRCODE = '22023';
  END IF;
  IF p_created_by IS NULL OR p_created_by = '' THEN
    RAISE EXCEPTION 'created_by required'
      USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('ipdm:' || v_year::TEXT));

  SELECT COALESCE(MAX(SUBSTRING(draft_no FROM '([0-9]+)$')::INT), 0) + 1
    INTO v_next_seq
    FROM public.import_pricing_draft_meta
   WHERE draft_no LIKE v_prefix || '%';

  v_draft_no := v_prefix || LPAD(v_next_seq::TEXT, 3, '0');

  INSERT INTO public.import_pricing_draft_meta (draft_no, draft_name, tab_type, created_by)
  VALUES (v_draft_no, p_draft_name, p_tab_type, p_created_by)
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

COMMENT ON FUNCTION public.generate_draft_no(TEXT, TEXT, TEXT) IS
  '책정안 번호 PR-YYYY-NNN 원자적 생성 + import_pricing_draft_meta INSERT. 연도별 리셋, 탭 무관 통합 카운터, advisory_xact_lock 직렬화.';
