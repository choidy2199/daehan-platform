// ad_products 테이블 행 (DB 스키마 그대로)
export interface AdProduct {
  id: number;
  product_code: string | null;
  product_source: string;
  ncc_product_id: string | null;
  origin_product_no: string | null;
  channel_product_no: string | null;
  campaign_id: string | null;
  bid_amt: number | null;
  auto_bid_enabled: boolean;
  target_roas_multiplier: number;
  daily_budget_limit: number | null;
  status: string;
  created_at: string;
  updated_at: string;
}

// ad_campaigns 테이블 행
export interface AdCampaign {
  ncc_campaign_id: string;
  name: string;
  status: string;
  daily_budget: number | null;
  // 나머지 필드는 필요 시 추가
}

// 단가표 (localStorage mw_products / mw_gen_products) 핵심 필드
// 전체 필드는 메모리 #21 참조. 여기선 화면에 필요한 것만.
export interface CatalogItem {
  code: string;
  model: string;              // 모델명
  category?: string;          // '파워툴' | '수공구' | '팩아웃' 등
  cost?: number;              // 원가
  priceNaver?: number;        // 네이버 판매가
  image?: string;             // 이미지 URL
  source?: string;            // mw_gen_products의 source 필드
}

// 단가표 매칭 후 UI에 표시할 합쳐진 데이터
export interface ProductRow {
  // ad_products에서 온 것
  id: number;
  product_code: string | null;
  product_source: 'milwaukee' | 'general' | null;
  campaign_id: string | null;
  campaign_name: string | null;          // ad_campaigns에서 join
  bid_amt: number | null;
  daily_budget_limit: number | null;
  auto_bid_enabled: boolean;
  status: string;

  // 단가표에서 온 것 (매칭 안 되면 null)
  model: string | null;
  category: string | null;
  cost: number | null;
  priceNaver: number | null;
  image: string | null;
  matched: boolean;                      // true = 단가표 매칭 성공
}

// useProducts hook 반환 타입
export interface UseProductsResult {
  rows: ProductRow[];              // 페이지네이션 적용된 50건
  totalCount: number;              // 필터링 후 전체 개수
  matchedCount: number;            // 매칭 성공 개수
  unmatchedCount: number;          // 매칭 실패 개수
  loading: boolean;
  error: string | null;
  page: number;
  setPage: (page: number) => void;
  pageSize: number;                // 고정 50
  totalPages: number;
  totalFiltered: number;           // 필터링 통과 개수
  totalAll: number;                // 필터링 전 전체 개수
  allRows: ProductRow[];           // 필터링 전 전체 배열 (ProductsFilter 카운트용)
  refetchProducts: () => Promise<void>;
}

// 필터 타입
export type SourceTypeFilter = 'all' | 'milwaukee' | 'general' | 'unmatched';
export type StatusFilter = 'all' | 'on' | 'off';
export type CampaignFilter = 'all' | string; // 'all' or ncc_campaign_id
export type EfficiencyFilter = 'margin10' | 'margin20' | 'margin30';

export interface ProductFilters {
  sourceType: SourceTypeFilter;
  status: StatusFilter;
  campaignId: CampaignFilter;
  efficiency: EfficiencyFilter[];  // 빈 배열 = 전체
  searchQuery: string;
}

export const DEFAULT_FILTERS: ProductFilters = {
  sourceType: 'all',
  status: 'all',
  campaignId: 'all',
  efficiency: [],
  searchQuery: '',
};
