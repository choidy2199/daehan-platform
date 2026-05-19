CREATE TABLE IF NOT EXISTS ad_keywords (
  id BIGSERIAL PRIMARY KEY,
  ncc_keyword_id TEXT,
  ncc_campaign_id TEXT,
  ncc_adgroup_id TEXT,
  product_id BIGINT,
  keyword TEXT NOT NULL,
  monthly_search_volume INTEGER,
  comp_idx TEXT,
  click_rate NUMERIC(5,2),
  recommend_score INTEGER,
  bid_amt INTEGER,
  status TEXT DEFAULT 'ELIGIBLE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ad_keywords_product ON ad_keywords(product_id);
CREATE INDEX IF NOT EXISTS idx_ad_keywords_campaign ON ad_keywords(ncc_campaign_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_ad_keywords_ncc ON ad_keywords(ncc_keyword_id) WHERE ncc_keyword_id IS NOT NULL;
